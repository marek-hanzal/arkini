import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const migration0003UpgradeJobsAndProducerInputs: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.alterTable("playerUpgrade").addColumn("targetLevel", "integer").execute();
		await db.schema.alterTable("playerUpgrade").addColumn("startedAt", "text").execute();
		await db.schema.alterTable("playerUpgrade").addColumn("readyAt", "text").execute();
		await db.schema
			.createIndex("playerUpgrade_saveGameId_readyAt")
			.on("playerUpgrade")
			.columns([
				"saveGameId",
				"readyAt",
			])
			.execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropIndex("playerUpgrade_saveGameId_readyAt").ifExists().execute();
	},
};
