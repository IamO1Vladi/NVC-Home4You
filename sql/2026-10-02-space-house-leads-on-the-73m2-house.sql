-- Leads linked to the 73 m² house that may really be about the Space house (#35)
--
-- READ-ONLY. Two SELECTs, nothing else: no writes, no temp tables, no transaction.
-- Run it against the production database in the Azure portal's Query editor
-- (SQL database → Query editor) or any SQL client. Two result sets come back.
--
-- WHY. Until #35 the gallery served two houses as public id 15: the imported
-- „Разгъваема Къща - 73m² с веранда и двоен покрив" (QuickbaseRecordId 15) and the
-- „Космическа къща - капсула" made in the admin panel (SQL Id 15, no Quickbase id). An
-- enquiry stores the number in Offers.ModelId, and promoting it to a lead set
-- Leads.HouseId. Before #34 that always picked the 73 m² house, so a Space house enquiry
-- became a 73 m² lead, and the drafted reply quoted the 73 m² house's price.
--
-- HOW EACH ROW IS JUDGED (the Verdict column):
--   1 SPACE HOUSE   The offer opens with „Модел от сайта: Космическа къща - капсула". The
--                   server writes that line from the page the visitor was on (since #34), so
--                   it is decisive. Expect few or none: the same release (#34) stopped
--                   linking a shared "15" to either house, so such a lead only points at the
--                   73 m² house if someone linked it by hand.
--   2 UNDECIDED     The offer carries "15" and no model line, and was made after the Space
--                   house was created, while both houses answered to 15. Nothing in the row
--                   decides it. Read MessageStart; the Hint column flags the obvious words.
--   x ...           Shown for completeness, nothing to fix: the line names another model
--                   (MessageStart shows which), or the offer predates the Space house (only
--                   the 73 m² house was 15 then).
--
-- HouseLastChangedBy: the last time someone changed the lead's house in the panel, from the
-- audit log. Empty means nobody has since 2026-08-18, when the log starts: for a lead
-- created after that, the link is the one set when the enquiry was promoted, i.e. by the
-- code this ticket is about.
--
-- Fixing a row is a panel job: open the lead in Лийдове and pick the Space house as its
-- model. Doing it there records who changed it in Одит; a direct UPDATE would not.

SET NOCOUNT ON;

DECLARE @Prefix nvarchar(40) = N'Модел от сайта: ';

-- 1. The two houses. Expect exactly one row each. If either is missing, or the titles are
--    not the 73 m² house and the Space house, stop: everything below assumes these two.
SELECT N'73 m² house (Quickbase id 15)' AS [Role],
       h.Id AS HouseId, h.QuickbaseRecordId, h.TitleBg, h.Title, h.CreatedAt
FROM dbo.Houses AS h
WHERE h.QuickbaseRecordId = 15
UNION ALL
SELECT N'Space house (SQL id 15, made in the panel)',
       h.Id, h.QuickbaseRecordId, h.TitleBg, h.Title, h.CreatedAt
FROM dbo.Houses AS h
WHERE h.Id = 15 AND h.QuickbaseRecordId IS NULL;

-- 2. Leads whose house is the 73 m² one and whose enquiry carried "15" or names the
--    Space house. Verdict 1 and 2 first.
--
--    LEN(x + N'|') - 1 is the true length of x: LEN alone ignores trailing spaces, and the
--    prefix ends in one.
--
--    The line is compared with the house's title as stored. The server cleans the title it
--    writes (whitespace runs collapsed, invisible characters dropped); the live Space house
--    title has nothing for that to change (checked 2026-10-02), so the two agree.
WITH Big73 AS (
    SELECT Id FROM dbo.Houses WHERE QuickbaseRecordId = 15
),
SpaceHouse AS (
    -- The title the site sends is the Bulgarian one, or the default title when there is none.
    SELECT CreatedAt,
           @Prefix + COALESCE(NULLIF(TitleBg, N''), Title) AS Line,
           LEN(@Prefix + COALESCE(NULLIF(TitleBg, N''), Title) + N'|') - 1 AS LineLength
    FROM dbo.Houses
    WHERE Id = 15 AND QuickbaseRecordId IS NULL
),
Candidates AS (
    SELECT
        l.Id AS LeadId, l.Name, l.Status, l.OwnerUpn, l.CreatedAt AS LeadCreatedAt,
        o.Id AS OfferId, o.ModelId, o.CreatedAt AS OfferedAt, o.Message,
        CASE
            -- The whole title, then the end of the line: " — <link>", a line break, or
            -- the end of the message. Otherwise a longer title starting the same way
            -- („… капсула 2", „… капсула XL") would count.
            WHEN LEFT(o.Message, s.LineLength) = s.Line
                 AND (DATALENGTH(o.Message) / 2 = s.LineLength
                      OR SUBSTRING(o.Message, s.LineLength + 1, 1) IN (NCHAR(10), NCHAR(13))
                      OR SUBSTRING(o.Message, s.LineLength + 1, 3) = N' — ')
                THEN N'1 SPACE HOUSE: its model line names it'
            WHEN LEFT(o.Message, LEN(@Prefix + N'|') - 1) = @Prefix
                THEN N'x the model line names another model'
            WHEN o.CreatedAt < s.CreatedAt
                THEN N'x before the Space house existed: the 73 m² house'
            ELSE N'2 UNDECIDED: read the message'
        END AS Verdict
    FROM dbo.Leads AS l
    JOIN Big73 AS b ON l.HouseId = b.Id
    JOIN dbo.Offers AS o ON o.Id = l.OfferId
    CROSS JOIN SpaceHouse AS s
    WHERE LTRIM(RTRIM(o.ModelId)) = N'15'
       OR LEFT(o.Message, s.LineLength) = s.Line
)
SELECT
    c.Verdict,
    c.LeadId,
    c.Name,
    c.Status,
    c.OwnerUpn,
    c.OfferId,
    c.ModelId,
    c.OfferedAt,
    c.LeadCreatedAt,
    (SELECT TOP (1) CONCAT(COALESCE(a.ActorUpn, N'system'), N' on ', CONVERT(nvarchar(16), a.OccurredAt, 120))
     FROM dbo.AuditEntries AS a
     WHERE a.EntityType = N'Lead'
       AND a.EntityId = CONVERT(nvarchar(64), c.LeadId)
       AND a.Action = N'updated'
       AND a.ChangesJson LIKE N'%"Field":"HouseId"%'
     ORDER BY a.OccurredAt DESC) AS HouseLastChangedBy,
    CASE
        WHEN c.Message LIKE N'%космическ%' OR c.Message LIKE N'%капсул%'
          OR c.Message LIKE N'%space%' OR c.Message LIKE N'%capsule%'
          OR c.Message LIKE N'%κάψουλ%' OR c.Message LIKE N'%διαστημ%'
          OR c.Message LIKE N'%55 000%' OR c.Message LIKE N'%55000%' OR c.Message LIKE N'%55.000%'
            THEN N'mentions space / capsule / 55 000'
        WHEN c.Message LIKE N'%73%' OR c.Message LIKE N'%28 000%' OR c.Message LIKE N'%28000%' OR c.Message LIKE N'%28.000%'
            THEN N'mentions 73 m² / 28 000'
        ELSE N''
    END AS Hint,
    LEFT(REPLACE(REPLACE(c.Message, NCHAR(13), N' '), NCHAR(10), N' '), 400) AS MessageStart
FROM Candidates AS c
ORDER BY c.Verdict, c.OfferedAt;
