// From how many units a partner order gets a lower price, as the owner gave it on 2026-10-15:
// "they get lower prices based on the units they order ... Box houses as well, however we
// lower them if they order more than 2". Numbers only: the partner page, its questions, its
// SEO line and its form read them from here, so a change is one line.
//
// No percentages or tiers: the exact price is in the offer for the quantity. Containers keep
// the long-standing 6 while the owner confirms it.
export const PARTNER_MIN_UNITS = {
  container: 6,
  box: 3,
}
