import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const migration0003PlayerInventoryUpgrades: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.alterTable("saveGame")
			.addColumn("playerInventorySlots", "integer", (col) => col.notNull().defaultTo(12))
			.execute();

		await db.schema
			.createTable("playerInventoryStack")
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("saveGameId", "text", (col) =>
				col.notNull().references("saveGame.id").onDelete("cascade"),
			)
			.addColumn("slotIndex", "integer", (col) => col.notNull())
			.addColumn("itemDefinitionId", "text", (col) => col.notNull())
			.addColumn("quantity", "integer", (col) => col.notNull())
			.addColumn("createdAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("updatedAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addUniqueConstraint("playerInventoryStack_saveGameId_slotIndex", [
				"saveGameId",
				"slotIndex",
			])
			.execute();

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
			.createIndex("playerInventoryStack_saveGameId")
			.on("playerInventoryStack")
			.column("saveGameId")
			.execute();
		await db.schema
			.createIndex("playerUpgrade_saveGameId")
			.on("playerUpgrade")
			.column("saveGameId")
			.execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropTable("playerUpgrade").ifExists().execute();
		await db.schema.dropTable("playerInventoryStack").ifExists().execute();
	},
};
