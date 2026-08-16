import { prisma } from "./db";
import { DEFAULT_COMPOUNDS, DEFAULT_INDICATIONS } from "./compounds";

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
