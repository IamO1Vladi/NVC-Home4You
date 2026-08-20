using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <summary>
    /// Renames the documents that were filed under a key describing the wrong thing.
    ///
    /// Nothing about the schema changed, which is why EF generated this empty: the Kind
    /// column already holds a string of the right width. What changed is the vocabulary. A
    /// purchase now carries four documents rather than two, because a customer pays twice
    /// and each payment is invoiced twice over, and the old 'prepaid-invoice' sat exactly
    /// where two of the new four now go.
    ///
    /// The rows are moved rather than the key being left alone to mean whatever it used to.
    /// Every file uploaded under 'prepaid-invoice' was a ПРОФОРМА issued against the deposit
    /// — the panel's own label said so, and the constant's comment said so; only the key
    /// disagreed. So the rename loses nothing that was ever true and stops the next person
    /// reading the table from filing a deposit invoice under a proforma's name, or the panel
    /// from drawing an old document in the wrong one of its payment slots. 'final-invoice'
    /// keeps its key because it already means what it says, so no row of it moves.
    ///
    /// Run this BEFORE the code that expects it — see the migration step in DEPLOY.md. Until
    /// it has, a deposit proforma still carries the old key and the new sheet draws it in its
    /// catch-all rather than in its own slot, which is visible and correctable; the other
    /// order would be an invisible document and a duplicate upload.
    /// </summary>
    public partial class RenamePrepaidInvoiceKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE [PurchaseFiles] SET [Kind] = 'deposit-proforma' WHERE [Kind] = 'prepaid-invoice';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sends the same rows back, and anything filed as a deposit proforma after this
            // migration goes with them. That is the honest reverse: on the far side of Down
            // there is no key for those documents to be, and dropping them into 'other' does
            // not help — the sheet that goes back with it had two slots and nothing that
            // draws an 'other'.
            //
            // ONE-WAY for the two kinds that are genuinely new, and worth saying out loud
            // rather than leaving to be discovered. A фактура за капарото and a проформа за
            // финалното плащане filed while this release was live keep their keys through
            // Down, because the old vocabulary has nowhere to put them. If the code goes
            // back with the database, those rows are stranded: the old sheet had two slots
            // and no bucket for a kind it does not know, so the documents sit in the table
            // unreachable from any screen until the release rolls forward again. They are
            // still there and nothing deletes them — but a rollback is not a clean undo for
            // them, and pretending otherwise is how somebody re-uploads a document that was
            // never actually gone.
            migrationBuilder.Sql(
                "UPDATE [PurchaseFiles] SET [Kind] = 'prepaid-invoice' WHERE [Kind] = 'deposit-proforma';");
        }
    }
}
