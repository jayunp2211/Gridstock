// Who is behind the site, as shown on the about page.
//
// Buyers of expensive equipment look up the person they are dealing with, so the founder's name and
// public profile are shown. Both were given by the founder for this purpose. Nobody else's name goes
// on a public page without their say.
export const OPERATOR: { name: string | null; profile: { label: string; href: string } | null } = {
  name: 'Jayun Patel',
  profile: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jayunpatel/' },
};

/** The success fee, as a percentage of the agreed price. New deals take this rate from the database default. */
export const FEE_PCT = 5;

/** Where a buyer can find an independent testing firm for electrical equipment. */
export const NETA = { label: 'NETA', href: 'https://www.netaworld.org/accreditation/overview' };
