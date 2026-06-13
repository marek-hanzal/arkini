import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const migration0002PlayerResource: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable("playerResource")
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("saveGameId", "text", (col) =>
				col.notNull().references("saveGame.id").onDelete("cascade"),
			)
			.addColumn("resourceDefinitionId", "text", (col) => col.notNull())
			.addColumn("quantity", "integer", (col) => col.notNull())
			.addColumn("createdAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("updatedAt", "text", (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addUniqueConstraint("playerResource_saveGameId_resourceDefinitionId", [
				"saveGameId",
				"resourceDefinitionId",
			])
			.execute();

		await db.schema
			.createIndex("playerResource_saveGameId")
			.on("playerResource")
			.column("saveGameId")
			.execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropTable("playerResource").ifExists().execute();
	},
};
