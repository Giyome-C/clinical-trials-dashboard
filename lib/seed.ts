import { prisma } from "./db";
import { DEFAULT_COMPOUNDS, DEFAULT_INDICATIONS } from "./compounds";
import { DEFAULT_COMPANIES } from "./companies";

// Idempotent — safe to call on every cold start. Only inserts rows that
// don't already exist (matched by unique `name`), so indications/compounds
// the user has added or removed from the sidebar are left alone.
export async function ensureSeeded() {
  await Promise.all(
    DEFAULT_INDICATIONS.map((ind) =>
      prisma.indication.upsert({
        where: { name: ind.name },
        update: {},
        create: { name: ind.name, searchTerm: ind.searchTerm, isDefault: true },
      })
    )
  );

  await Promise.all(
    DEFAULT_COMPOUNDS.map((c) =>
      prisma.compound.upsert({
        where: { name: c.name },
        update: {},
        create: { name: c.name, aliases: c.aliases, isDefault: true },
      })
    )
  );
}

// Same idempotent pattern as ensureSeeded(), for the tracked-companies
// roster. Kept separate so a refresh can seed just companies without
// touching trial tracking, and vice versa.
export async function ensureCompaniesSeeded() {
  await Promise.all(
    DEFAULT_COMPANIES.map((c) =>
      prisma.company.upsert({
        where: { name: c.name },
        update: {},
        create: { name: c.name, ticker: c.ticker, cik: c.cik, fdaSponsorNames: c.fdaSponsorNames, isDefault: true },
      })
    )
  );
}
