import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { emptyInventoryStateJson } from "~/inventory/logic/emptyInventoryStateJson";
import { json } from "~/shared/json";
import { parseJson } from "~/shared/parseJson";

interface ItemInstanceMigrationTable {
	id: string;
	saveGameId: string;
	itemDefinitionId: string;
	quantity: number;
	locationKind: string;
	boardX: number | null;
	boardY: number | null;
	inventorySlotIndex: number | null;
	ownerItemInstanceId: string | null;
	inputItemDefinitionId: string | null;
	stateJson: string;
	createdAt: string;
	updatedAt: string;
}

interface CraftInputMigrationDatabase {
	itemInstance: ItemInstanceMigrationTable;
}

interface BoardItemStateMigrationShape {
	activation?: unknown;
	craft?: {
		delivered?: Record<string, number>;
		startedAt?: string;
		readyAt?: string;
		remainingMs?: number;
	};
}

export const migration0006CraftInputInstances: Migration = {
	async up(db: Kysely<unknown>) {
		const database = db as Kysely<CraftInputMigrationDatabase>;
		await database.schema
			.createIndex("itemInstance_craftInputOwner")
			.ifNotExists()
			.on("itemInstance")
			.columns([
				"locationKind",
				"ownerItemInstanceId",
				"itemDefinitionId",
			])
			.execute();

		const rows = await database
			.selectFrom("itemInstance")
			.select([
				"id",
				"saveGameId",
				"stateJson",
			])
			.where("locationKind", "in", [
				"board",
				"inventory",
			])
			.execute();

		for (const row of rows) {
			const state = parseJson<BoardItemStateMigrationShape>(row.stateJson || "{}");
			const delivered = state.craft?.delivered ?? {};
			const entries = Object.entries(delivered).filter(([, quantity]) => quantity > 0);
			if (!entries.length) continue;

			const timestamp = new Date().toISOString();
			for (const [itemId, quantity] of entries) {
				await database
					.insertInto("itemInstance")
					.values({
						id: `${row.id}:craft-input:${itemId}`,
						saveGameId: row.saveGameId,
						itemDefinitionId: itemId,
						quantity,
						locationKind: "craft-input",
						boardX: null,
						boardY: null,
						inventorySlotIndex: null,
						ownerItemInstanceId: row.id,
						inputItemDefinitionId: itemId,
						stateJson: emptyInventoryStateJson,
						createdAt: timestamp,
						updatedAt: timestamp,
					})
					.execute();
			}

			const nextCraft = {
				startedAt: state.craft?.startedAt,
				readyAt: state.craft?.readyAt,
				remainingMs: state.craft?.remainingMs,
			};
			const nextState: BoardItemStateMigrationShape = {
				...state,
				craft: Object.values(nextCraft).some((value) => value !== undefined)
					? nextCraft
					: undefined,
			};
			await database
				.updateTable("itemInstance")
				.set({
					stateJson: json(nextState),
				})
				.where("id", "=", row.id)
				.execute();
		}
	},
	async down(db: Kysely<unknown>) {
		const database = db as Kysely<CraftInputMigrationDatabase>;
		await database
			.deleteFrom("itemInstance")
			.where("locationKind", "=", "craft-input")
			.execute();
	},
};
