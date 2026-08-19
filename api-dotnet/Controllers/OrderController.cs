using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Services;

namespace Controllers;

// The customer's own view of their order (ROADMAP #27).
//
// THE ONE ANONYMOUS ENDPOINT IN THIS FEATURE, and the reasoning behind every line of it:
//
//   - The code in the URL is the only credential, so what it opens must be worth exactly
//     that much. PublicOrderDto carries a status, two expected dates, the model name and
//     the carrier's last word. No price, no deposit, no balance, no name, no address, no
//     ЕГН — not blanked, but absent from the type. See OrderTrackingService.
//   - A revoked or unknown code answers 404 identically, so a stranger cannot learn which
//     codes once existed by watching the difference.
//   - no-store, because a tracking page on a shared machine should not survive the tab.
//
// Rate limiting is deliberately NOT here: the codes are 56^10, and the endpoint reads one
// indexed row. If that ever changes, this is the comment that says why it was safe.
[ApiController]
[Route("api/order")]
public class OrderController : ControllerBase
{
    private readonly OrderTrackingService _svc;

    public OrderController(OrderTrackingService svc) => _svc = svc;

    [HttpGet("{reference}")]
    public async Task<IActionResult> Get(string reference, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";

        var order = await _svc.PublicAsync(reference, ct);
        return order is null ? NotFound(new { error = "not_found" }) : Ok(order);
    }
}
