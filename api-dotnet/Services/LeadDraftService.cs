using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.Extensions.Logging;

namespace Services;

/// <summary>
/// Turns a lead's context into a suggested reply.
///
/// DRAFT ONLY — nothing here sends anything. The output lands in a textarea a salesperson
/// edits and chooses to send, which is the whole safety model: a wrong draft costs a few
/// seconds, and no amount of prompt care would make auto-sending to a customer wise.
///
/// The interesting work happened in LeadDraftContextBuilder, which decides what the model
/// gets to read. This class is the thin part: a system prompt, one API call, and honest
/// failure handling.
/// </summary>
public class LeadDraftService
{
    private readonly LeadDraftContextBuilder _context;
    private readonly EnvConfig _env;
    private readonly ILogger<LeadDraftService> _log;

    public LeadDraftService(LeadDraftContextBuilder context, EnvConfig env, ILogger<LeadDraftService> log)
    {
        _context = context;
        _env = env;
        _log = log;
    }

    public bool IsConfigured => _env.DraftsConfigured;

    // Thinking is on by default on this model and MaxTokens caps thinking plus the reply
    // together, so a ceiling sized for the email alone would truncate mid-sentence. A
    // sales reply is a few hundred tokens; the rest is headroom for reasoning.
    private const int MaxTokens = 8000;

    public enum DraftOutcome { Ok, NotConfigured, LeadNotFound, Refused, Failed }

    public record DraftResult(DraftOutcome Outcome, string? Text, string? Error)
    {
        public bool Ok => Outcome == DraftOutcome.Ok;

        public static DraftResult Success(string text) => new(DraftOutcome.Ok, text, null);
        public static DraftResult Fail(DraftOutcome outcome, string error) => new(outcome, null, error);
    }

    /// <summary>
    /// Drafts a reply for one lead. Never throws for an expected failure — the caller is
    /// a button in the admin panel, and every outcome here needs to become a message a
    /// salesperson can act on rather than a 500.
    /// </summary>
    public async Task<DraftResult> DraftReplyAsync(int leadId, string? instruction, CancellationToken ct = default)
    {
        if (!IsConfigured)
            return DraftResult.Fail(DraftOutcome.NotConfigured, "Drafting is not configured.");

        var context = await _context.BuildAsync(leadId, ct);
        if (context is null)
            return DraftResult.Fail(DraftOutcome.LeadNotFound, "No such lead.");

        try
        {
            var client = new AnthropicClient { ApiKey = _env.AnthropicApiKey };

            var response = await client.Messages.Create(new MessageCreateParams
            {
                Model = "claude-opus-5",
                MaxTokens = MaxTokens,

                // The system prompt is identical for every draft, so it is worth caching:
                // each subsequent draft reads it at a fraction of the price. The per-lead
                // context deliberately goes in the user turn, AFTER this — putting it here
                // would change the cached prefix on every single request and the cache
                // would never be read.
                System = new List<TextBlockParam>
                {
                    new()
                    {
                        Text = SystemPrompt,
                        CacheControl = new CacheControlEphemeral(),
                    },
                },

                OutputConfig = new OutputConfig { Effort = ParseEffort(_env.DraftEffort) },

                Messages =
                [
                    new() { Role = Role.User, Content = BuildUserTurn(context, instruction) },
                ],
            }, cancellationToken: ct);

            // Check the stop reason BEFORE reading content. A refusal returns HTTP 200
            // with empty or partial content, so indexing straight into Content would
            // either throw or hand a salesperson half a sentence as though it were done.
            if (response.StopReason == "refusal")
            {
                _log.LogWarning("Draft refused for lead {LeadId}: {Category}",
                    leadId, response.StopDetails?.Category);
                return DraftResult.Fail(DraftOutcome.Refused,
                    "The model declined to draft this reply.");
            }

            var text = string.Join("\n",
                response.Content
                    .Select(b => b.Value)
                    .OfType<TextBlock>()
                    .Select(t => t.Text)).Trim();

            if (string.IsNullOrWhiteSpace(text))
                return DraftResult.Fail(DraftOutcome.Failed, "The model returned nothing.");

            return DraftResult.Success(text);
        }
        catch (OperationCanceledException)
        {
            throw;   // the caller went away; not our failure to report
        }
        catch (Exception ex)
        {
            // Rate limits, an expired key, a network blip. Logged with detail, reported
            // to sales as "try again" — the panel is not the place to surface an API
            // error string, and the lead is still there to reply to by hand.
            _log.LogError(ex, "Draft failed for lead {LeadId}", leadId);
            return DraftResult.Fail(DraftOutcome.Failed, "Could not produce a draft. Try again.");
        }
    }

    private static Effort ParseEffort(string raw) => raw switch
    {
        "low" => Effort.Low,
        "high" => Effort.High,
        "max" => Effort.Max,
        _ => Effort.Medium,
    };

    // Stable across every request so it caches. Anything lead-specific belongs in the
    // user turn.
    //
    // Public so the tests can assert on it. The rules below are the ones sales relies on
    // — "never invent a price" above all — and a silent edit to any of them should fail a
    // test rather than surface as a wrong number in a customer's inbox.
    public const string SystemPrompt = """
        You draft email replies for the sales team at NVC-HOME4YOU, a Bulgarian company
        that manufactures and delivers prefabricated, modular and foldable "box" houses.

        Your draft goes into a text box that a salesperson reads, edits and decides whether
        to send. It is never sent automatically. Write the email body only — no subject
        line, no "Here is a draft" preamble, no commentary.

        Rules that matter more than style:

        - Never state a price, dimension, delivery time or specification that is not given
          to you below. If the customer asks about something you have not been told, say
          the colleague will confirm it rather than guessing. A number you invent becomes
          a promise the company has to keep.
        - You are given the model this enquiry is about, and a price list of the rest of
          the range. Both are the live catalogue, so USE them: quote those prices, answer
          from that description, and suggest another model by name and price when the
          customer's budget or size points somewhere else. Being unhelpfully vague about
          something you were told is its own failure.
        - Prices in the list are the catalogue price for the model as standard. If the
          customer is asking about options, transport, groundwork or anything the list
          does not cover, say the figure is for the standard model and that a colleague
          will confirm the rest — do not add anything up.
        - Reply in the customer's language, given as the locale below: bg = Bulgarian,
          el = Greek, en = English. If no locale is given, match the language of the
          customer's own most recent message.
        - Answer what the customer actually asked. If their last message contains a
          question, that question is the point of the reply.
        - Sign off as the company, not as a named person — the salesperson adds their own
          name if they want it.

        Tone: warm, direct and practical. These are people buying a house, often their
        first prefab, so plain language beats sales language. Short paragraphs. No bullet
        lists unless you are genuinely enumerating options.
        """;

    /// <summary>
    /// The per-lead half of the prompt. Split out from the API call so it can be asserted
    /// on in tests without a key.
    /// </summary>
    public static string BuildUserTurn(LeadDraftContext context, string? instruction)
    {
        var sb = new StringBuilder();

        sb.AppendLine("Customer: " + context.CustomerName);
        sb.AppendLine("Locale: " + (string.IsNullOrWhiteSpace(context.Locale) ? "(unknown)" : context.Locale));
        sb.AppendLine("Deal stage: " + context.Status);

        if (!string.IsNullOrWhiteSpace(context.ModelSummary))
        {
            sb.AppendLine();
            sb.AppendLine("What they are asking about (use these figures, do not invent others):");
            sb.AppendLine(context.ModelSummary);

            if (!string.IsNullOrWhiteSpace(context.ModelDetail))
            {
                sb.AppendLine();
                sb.AppendLine("Catalogue description of that model:");
                sb.AppendLine(context.ModelDetail);
            }
        }

        // After the model they asked about, never instead of it. The one they named is
        // the answer; the range is context for "what else do you have?".
        if (!string.IsNullOrWhiteSpace(context.PriceList))
        {
            sb.AppendLine();
            sb.AppendLine(
                "The rest of the range, current catalogue prices for the standard model " +
                "(you may quote these; anything not listed here, a colleague confirms):");
            sb.AppendLine(context.PriceList);
        }

        if (context.Notes.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("What we know about this lead:");
            foreach (var note in context.Notes) sb.AppendLine("- " + note);
        }

        sb.AppendLine();
        sb.AppendLine("Conversation so far, oldest first:");
        sb.AppendLine(string.IsNullOrWhiteSpace(context.ThreadTranscript)
            ? "(nothing recorded yet — this is the first contact)"
            : context.ThreadTranscript);

        sb.AppendLine();
        // The salesperson's own steer goes LAST, so it is the freshest instruction in the
        // prompt rather than something the transcript can bury.
        sb.AppendLine(string.IsNullOrWhiteSpace(instruction)
            ? "Draft the reply."
            : "Draft the reply. The salesperson asks specifically: " + instruction!.Trim());

        return sb.ToString();
    }
}
