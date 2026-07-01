// America's 250th flash sale: $17.76 down payment secures any available
// property. Window is hardcoded in UTC because July in the US is always
// EDT (UTC-4), so there's no DST ambiguity to resolve at build time.
const SALE_START = new Date("2026-07-01T04:00:00Z"); // July 1, 12:00am ET
const SALE_END = new Date("2026-07-07T04:00:00Z"); // July 7, 12:00am ET (end of July 6)

export default function () {
  const now = new Date();
  return {
    active: now >= SALE_START && now < SALE_END,
    phone: "7069630017",
    phoneDisplay: "706-963-0017",
  };
}
