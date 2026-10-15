// The pages whose enquiries are not about a house, as the keys /api/offer accepts in its
// optional `origin` field (2026-10-15). A fixed list the server checks — anything else is a
// 400 — so it lives in one place: sendOffer.js sends them, configPrefill.js lets the shared
// offer modal carry one. src/lib/__fixtures__/enquiry-origins.json is the contract file the
// API's tests (EnquiryOriginTests) and the SPA's both read.
export const ENQUIRY_ORIGINS = Object.freeze(['doors', 'interiors', 'about'])
