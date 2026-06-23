// Location-benefit content for the "lifestyle" section on property detail
// pages. Keyed by state abbreviation. This describes the region/market,
// not the specific parcel, so it stays separate from per-property
// Airtable-driven facts (zoning, road access, etc., shown elsewhere on
// the page). Falls back to a generic entry for any state not listed here.

const icons = {
  sun: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="16" cy="16" r="6"/><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3"/></svg>',
  mountain: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 26L13 10l5 7 4-5 7 14H3z"/></svg>',
  water: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 22c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2 3-2 5-2"/><path d="M3 16c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2 3-2 5-2"/></svg>',
  tag: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 4h8a2 2 0 0 1 2 2v8L13 29 3 19 18 4z"/><circle cx="22" cy="10" r="2" fill="currentColor" stroke="none"/></svg>',
  build: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 14L16 4l12 10v14H20v-8h-8v8H4V14z"/></svg>',
  calendar: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="26" height="22" rx="2"/><path d="M3 12h26M10 3v6M22 3v6"/></svg>',
};

const markets = {
  FL: {
    heading: 'Why Buyers Choose Putnam County',
    subtext: "Florida land, owner financed, in one of the state's quieter inland counties.",
    items: [
      { icon: 'sun', title: 'Mild Winters', description: "Florida's winters stay mild, so the land is usable year-round, not just in summer." },
      { icon: 'water', title: 'Lake Country', description: 'Putnam County sits in Florida’s inland lake region, away from the coastal crowds.' },
      { icon: 'tag', title: 'No State Income Tax', description: 'Florida charges no state income tax, a real savings if you relocate here.' },
      { icon: 'build', title: 'Room to Spread Out', description: 'Rural Putnam County offers low-density, quiet surroundings at a fraction of coastal prices.' },
    ],
  },
  NM: {
    heading: 'Why Buyers Choose Luna County',
    subtext: 'Wide-open New Mexico high desert, with one of the lowest costs of entry in the Southwest.',
    items: [
      { icon: 'sun', title: 'High Desert Sun', description: "New Mexico's high desert is known for clear skies and sunshine most of the year." },
      { icon: 'mountain', title: 'Big Sky, No Crowds', description: "Luna County's open desert means real space and low population density." },
      { icon: 'tag', title: 'Low Cost of Entry', description: 'Land here costs a fraction of coastal markets, with no bank or credit check required.' },
      { icon: 'calendar', title: 'Build at Your Pace', description: 'Many lots in this market carry no required timeline to start construction.' },
    ],
  },
  OR: {
    heading: 'Why Buyers Choose Klamath County',
    subtext: "Southern Oregon's high desert and forest country, within reach of Crater Lake.",
    items: [
      { icon: 'mountain', title: 'Four Distinct Seasons', description: "Klamath County's high desert climate gives you real seasonal variety, unlike the Oregon coast." },
      { icon: 'water', title: 'Near Crater Lake', description: 'Klamath Falls is the gateway to Crater Lake National Park, a short drive from this region.' },
      { icon: 'tag', title: 'Small-Town Pace', description: 'Southern Oregon offers a slower, rural pace of life compared to the I-5 corridor.' },
      { icon: 'build', title: 'Room to Build', description: 'Open acreage in this market gives you room to build, park an RV, or simply hold the land.' },
    ],
  },
  AZ: {
    heading: 'Why Buyers Choose Apache County',
    subtext: "Northeastern Arizona's high desert, near the White Mountains and Petrified Forest.",
    items: [
      { icon: 'sun', title: 'High Desert Climate', description: "Apache County sits at higher elevation than Phoenix, with milder temperatures than the low desert." },
      { icon: 'mountain', title: 'Near the White Mountains', description: 'This region borders the White Mountains, one of the cooler, greener parts of Arizona.' },
      { icon: 'tag', title: 'Affordable High-Desert Living', description: 'Land in this market costs a fraction of comparable acreage near Phoenix or Tucson.' },
      { icon: 'build', title: 'Off-Grid Friendly', description: 'Many lots in this market support solar, septic, and propane for independent living.' },
    ],
  },
};

const fallback = {
  heading: 'Why Buyers Choose This Market',
  subtext: 'Affordable land, owner financed, with no bank and no credit check.',
  items: [
    { icon: 'tag', title: 'Low Cost of Entry', description: 'Owner financing with no bank and no credit check required.' },
    { icon: 'calendar', title: 'Flexible Terms', description: 'Simple monthly payments direct from the property owner.' },
    { icon: 'build', title: 'Room to Build', description: 'Open acreage with room to build, park an RV, or hold as an investment.' },
  ],
};

export default function () {
  return { markets, icons, fallback };
}
