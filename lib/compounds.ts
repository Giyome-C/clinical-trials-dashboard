// Seed data used the first time the app runs (see lib/seed.ts). After that,
// indications and compounds live in the database and can be edited from the
// left-hand sidebar ("+ Add indication" / "+ Add compound") without a
// redeploy.

export interface CompoundSeed {
  name: string;
  aliases: string[];
}

export const DEFAULT_INDICATIONS: { name: string; searchTerm: string }[] = [
  { name: "Atopic Dermatitis", searchTerm: "Atopic Dermatitis" },
  { name: "Hidradenitis Suppurativa", searchTerm: "Hidradenitis Suppurativa" },
];

// "Abdakibart (or AVTX-009)" -> name "Abdakibart", alias "AVTX-009", etc.
// Note: "Tibulizumb" is carried over exactly as supplied, with "Tibulizumab"
// added as an alias in case that's the intended spelling — remove it in the
// sidebar's compound editor if that's wrong.
export const DEFAULT_COMPOUNDS: CompoundSeed[] = [
  { name: "LAD191", aliases: [] },
  { name: "SAR445399", aliases: [] },
  { name: "CAN10", aliases: [] },
  { name: "STLX-2012", aliases: [] },
  { name: "Leo 158968", aliases: ["LEO158968"] },
  { name: "HLX109", aliases: [] },
  { name: "IBI3011", aliases: [] },
  { name: "DXP-10", aliases: [] },
  { name: "Remibrutinib", aliases: [] },
  { name: "Lutikizumab", aliases: [] },
  { name: "Upadacitinib", aliases: [] },
  { name: "Abdakibart", aliases: ["AVTX-009"] },
  { name: "Tulisokibart", aliases: [] },
  { name: "Brivekimig", aliases: [] },
  { name: "NAV-240", aliases: [] },
  { name: "Tibulizumb", aliases: ["Tibulizumab"] },
  { name: "Eltrekibart", aliases: [] },
  { name: "LAD328", aliases: [] },
  { name: "Ritlecitinib", aliases: [] },
  { name: "Izicopan", aliases: [] },
  { name: "Zasocitinib", aliases: [] },
  { name: "KT-485", aliases: [] },
];

// Builds a CT.gov "Essie" query string that ORs the compound name with all
// of its known aliases, quoting multi-word/hyphenated terms so they're
// matched as phrases rather than split into separate word searches.
export function buildInterventionQuery(name: string, aliases: string[]): string {
  const terms = [name, ...aliases].filter(Boolean);
  return terms.map((t) => (/[\s-]/.test(t) ? `"${t}"` : t)).join(" OR ");
}
