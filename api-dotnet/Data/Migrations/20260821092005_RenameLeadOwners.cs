using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace apidotnet.Data.Migrations
{
    /// <summary>
    /// Moves three salespeople onto the company domain, on the leads they currently own.
    ///
    /// Nothing about the schema changed, which is why EF generated this empty: OwnerUpn is
    /// already a string of the right width. What changed is the people's addresses — an
    /// abv.bg account, a quickbase.com account and a gmail.com account, all three from before
    /// there was an nvc-home4you.eu tenant to be in.
    ///
    /// It has to be a migration rather than a settings change because the отговорник dropdown
    /// is built from ADMIN_ALLOWED_USERS plus every distinct OwnerUpn already on a lead (see
    /// LeadPipelineService.ListAssignableAsync). That second source exists so somebody who
    /// left the company can still be shown as the owner of their old leads instead of being
    /// silently reassigned — which means an address only stops appearing when the rows stop
    /// saying it. Taking the old addresses out of configuration alone would leave all three in
    /// the list forever, beside the new ones, with nothing on screen to say which is which.
    ///
    /// ONLY Lead.OwnerUpn IS TOUCHED, and the restraint is the substance of this migration.
    /// OwnerUpn is an ASSIGNMENT — a fact about now, "whose lead is this?" — and renaming it
    /// is just correcting where the answer points. Every other UPN column in this database is
    /// an ACTOR: LeadActivity.ActorUpn, AuditEntry.ActorUpn, the *UpdatedByUpn columns on
    /// customers, factories and sheets, OrderStatusEvent.ChangedByUpn, the UploadedByUpn on
    /// both file tables. Each of those records who did something on the day they did it, at
    /// the address that was theirs that day. Rewriting one to match a later rename does not
    /// tidy the history, it falsifies it: the log would then claim an account sent an email
    /// months before that account existed, and an audit trail that has been edited to look
    /// consistent is worth less than one with an old address in it.
    ///
    /// Anyone reading a thread and wondering who bonin01@abv.bg was has the answer in the
    /// Owner column of the same lead. That is the right direction for the lookup to run.
    /// </summary>
    public partial class RenameLeadOwners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // One statement per person rather than a CASE, so the pairs stay legible and a
            // fourth rename is a line rather than an edit to an expression.
            migrationBuilder.Sql(
                "UPDATE [Leads] SET [OwnerUpn] = 'tbonin@nvc-home4you.eu' " +
                "WHERE [OwnerUpn] = 'bonin01@abv.bg';");

            migrationBuilder.Sql(
                "UPDATE [Leads] SET [OwnerUpn] = 'vvladimirov@nvc-home4you.eu' " +
                "WHERE [OwnerUpn] = 'vvladimirov@quickbase.com';");

            migrationBuilder.Sql(
                "UPDATE [Leads] SET [OwnerUpn] = 'rivanova@nvc-home4you.eu' " +
                "WHERE [OwnerUpn] = 'radinaivanova64@gmail.com';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ONE-WAY, deliberately, and this used to send the three UPDATEs back the other
            // way on the reasoning that the new addresses belong to nobody else so the
            // reverse could not catch a row Up had not moved. That reasoning is wrong, and
            // checkably so: it assumes leads only started carrying an @nvc-home4you.eu owner
            // when this migration ran.
            //
            // They did not. The old addresses are what the CRM import copies out of Quickbase
            // (CrmLeadImportService reads the owner field straight across); the new ones are
            // what the APP writes, because LeadService.CreateAsync and PromoteOfferAsync set
            // OwnerUpn to the signed-in UPN and everybody has been signing in on the
            // nvc-home4you.eu tenant since the move — the app's own defaults, down to
            // LeadNotifyEmail, have named those mailboxes for months. So every lead created
            // or promoted in the panel since then already owns one of the three addresses
            // this migration renames TO.
            //
            // A symmetric Down would sweep all of those onto accounts that no longer exist.
            // Tsvetan's forty leads created as tbonin@nvc-home4you.eu would land on
            // bonin01@abv.bg, his "Mine" tab — which resolves owner=mine to the UPN he is
            // signed in with — would return nothing, and the dead address would be back in
            // the assignable dropdown, which is the exact condition Up exists to remove.
            //
            // Nothing here is destructive to roll forward again, which is what makes the
            // no-op affordable: on the far side of Down the old build reads an
            // @nvc-home4you.eu owner perfectly well — it is a string, and the dropdown builds
            // itself from whatever the rows say (LeadPipelineService.ListAssignableAsync). A
            // rollback therefore leaves the leads correctly assigned to their current owners.
            // Undoing the rename in earnest means writing the reverse migration by hand,
            // against a list of the rows it should touch.
        }
    }
}
