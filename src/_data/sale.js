// Black Friday 2026: 30% off total payments on owner-financed properties.
// Down payment, doc fee, and monthly payment stay the same; the term is cut
// by 30% (rounded down to a whole month, so the discount is never less than
// advertised). Times are hardcoded in UTC; late November is EST (UTC-5).
//
// Phases:
//   teaser: from deploy until the sale starts (banner only)
//   live:   Fri Nov 27 12:00am ET through Mon Nov 30 11:59pm ET
//           (banner + sale terms on cards and property pages)
// SALE_NOW (ISO date) overrides "now" for local previews of each phase.
const TEASER_END = new Date("2026-11-27T05:00:00Z"); // Nov 27, 12:00am ET
const SALE_END = new Date("2026-12-01T05:00:00Z"); // Dec 1, 12:00am ET (end of Nov 30)

export default function () {
  const now = process.env.SALE_NOW ? new Date(process.env.SALE_NOW) : new Date();
  const phase = now < TEASER_END ? "teaser" : now < SALE_END ? "live" : null;
  return {
    active: phase !== null,
    phase,
    live: phase === "live",
    termCut: 0.3,
    phone: "7069630017",
    phoneDisplay: "706-963-0017",
  };
}
