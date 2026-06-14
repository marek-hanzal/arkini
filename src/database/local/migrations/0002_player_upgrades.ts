import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const migration0002PlayerUpgrades: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable("playerUpgrade")
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("saveGameId", "text", (col) =>
				col.notNull().references("saveGame.id").onDelete("cascade"),
			)
			.addColumn("upgradeDefinitionId", "text", (col) => col.notNull())
			.addColumn("level", "integer", (col) => col.notNull())
			.addColumn("createdAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("updatedAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addUniqueConstraint("playerUpgrade_saveGameId_upgradeDefinitionId", [
				"saveGameId",
				"upgradeDefinitionId",
			])
			.execute();

		await db.schema
			.createIndex("playerUpgrade_saveGameId")
			.on("playerUpgrade")
			.column("saveGameId")
			.execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropTable("playerUpgrade").ifExists().execute();
	},
};
