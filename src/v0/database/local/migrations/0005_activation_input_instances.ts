import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { json } from "~/v0/style/json";
import { parseJson } from "~/v0/style/parseJson";

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

interface ActivationInputMigrationDatabase {
	itemInstance: ItemInstanceMigrationTable;
}

interface BoardItemStateMigrationShape {
	activation?: {
		cooldownUntil?: string;
		remainingCharges?: number;
		inventory?: Record<string, number>;
	};
	craft?: unknown;
}

export const migration0005ActivationInputInstances: Migration = {
	async up(db: Kysely<unknown>) {
		const database = db as Kysely<ActivationInputMigrationDatabase>;
		await database.schema
			.createIndex("itemInstance_activationInputOwner")
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
			.where("locationKind", "=", "board")
			.execute();

		for (const row of rows) {
			const state = parseJson<BoardItemStateMigrationShape>(row.stateJson || "{}");
			const inventory = state.activation?.inventory ?? {};
			const entries = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
			if (!entries.length) continue;

			const timestamp = new Date().toISOString();
			for (const [itemId, quantity] of entries) {
				await database
					.insertInto("itemInstance")
					.values({
						id: `${row.id}:activation-input:${itemId}`,
						saveGameId: row.saveGameId,
						itemDefinitionId: itemId,
						quantity,
						locationKind: "activation-input",
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

			const nextActivation = {
				...state.activation,
			};
			delete nextActivation.inventory;
			const nextState: BoardItemStateMigrationShape = {
				...state,
				activation: Object.keys(nextActivation).length > 0 ? nextActivation : undefined,
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
		const database = db as Kysely<ActivationInputMigrationDatabase>;
		await database
			.deleteFrom("itemInstance")
			.where("locationKind", "=", "activation-input")
			.execute();
	},
};
