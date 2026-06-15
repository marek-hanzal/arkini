import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const migration0004ItemInstances: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable("itemInstance")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("saveGameId", "text", (col) =>
				col.notNull().references("saveGame.id").onDelete("cascade"),
			)
			.addColumn("itemDefinitionId", "text", (col) => col.notNull())
			.addColumn("quantity", "integer", (col) => col.notNull().defaultTo(1))
			.addColumn("locationKind", "text", (col) => col.notNull())
			.addColumn("boardX", "integer")
			.addColumn("boardY", "integer")
			.addColumn("inventorySlotIndex", "integer")
			.addColumn("ownerItemInstanceId", "text")
			.addColumn("inputItemDefinitionId", "text")
			.addColumn("stateJson", "text", (col) => col.notNull())
			.addColumn("createdAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("updatedAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.execute();

		await sql`
			insert or ignore into itemInstance (
				id,
				saveGameId,
				itemDefinitionId,
				quantity,
				locationKind,
				boardX,
				boardY,
				inventorySlotIndex,
				ownerItemInstanceId,
				inputItemDefinitionId,
				stateJson,
				createdAt,
				updatedAt
			)
			select
				id,
				saveGameId,
				itemDefinitionId,
				1,
				'board',
				x,
				y,
				null,
				null,
				null,
				stateJson,
				createdAt,
				updatedAt
			from boardItem
		`.execute(db);

		await sql`
			insert or ignore into itemInstance (
				id,
				saveGameId,
				itemDefinitionId,
				quantity,
				locationKind,
				boardX,
				boardY,
				inventorySlotIndex,
				ownerItemInstanceId,
				inputItemDefinitionId,
				stateJson,
				createdAt,
				updatedAt
			)
			select
				id,
				saveGameId,
				itemDefinitionId,
				quantity,
				'inventory',
				null,
				null,
				slotIndex,
				null,
				null,
				stateJson,
				createdAt,
				updatedAt
			from inventoryStack
		`.execute(db);

		await db.schema
			.createIndex("itemInstance_saveGameId_locationKind")
			.ifNotExists()
			.on("itemInstance")
			.columns([
				"saveGameId",
				"locationKind",
			])
			.execute();
		await db.schema.dropTable("inventoryStack").ifExists().execute();
		await db.schema.dropTable("boardItem").ifExists().execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropTable("itemInstance").ifExists().execute();
	},
};
