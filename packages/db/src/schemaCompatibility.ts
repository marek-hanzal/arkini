import { sql } from "kysely";
import { kysely } from "./client";

// Local OPFS databases survive code changes. During the prototype phase we may
// change the first migration before a user resets their browser DB, so this tiny
// repair pass adds additive columns that old databases are missing. Real schema
// changes still belong in migrations; this is just anti-footgun padding.
export async function repairPrototypeSchemaDrift() {
  await ensureColumn("assetDefinition", "isEnabled", "integer NOT NULL DEFAULT 1");
  await ensureColumn("itemDefinition", "isEnabled", "integer NOT NULL DEFAULT 1");
  await ensureColumn("mergeDefinition", "isEnabled", "integer NOT NULL DEFAULT 1");
  await ensureColumn("dropTableDefinition", "isEnabled", "integer NOT NULL DEFAULT 1");
  await ensureColumn("producerDefinition", "isEnabled", "integer NOT NULL DEFAULT 1");
  await ensureColumn("buildRecipeDefinition", "isEnabled", "integer NOT NULL DEFAULT 1");
}

async function ensureColumn(table: string, column: string, definition: string) {
  const tableExists = await sql<{ name: string }>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${table}
  `.execute(kysely);

  if (tableExists.rows.length === 0) {
    return;
  }

  const columns = await sql<{ name: string }>`PRAGMA table_info(${sql.raw(table)})`.execute(kysely);

  if (columns.rows.some((row) => row.name === column)) {
    return;
  }

  await sql.raw(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(column)} ${definition}`).execute(kysely);
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
