import { Kysely } from "kysely";
import { SQLocalKysely } from "sqlocal/kysely";
import type { Database } from "./schema";

export const databasePath = "arkini.sqlite3";

const sqlocal = new SQLocalKysely({
	databasePath,
	reactive: true,
	onInit: (sql) => [
		sql`PRAGMA foreign_keys = ON`,
		sql`PRAGMA journal_mode = WAL`,
		sql`PRAGMA synchronous = NORMAL`,
	],
});

export const kysely = new Kysely<Database>({
	dialect: sqlocal.dialect,
});
