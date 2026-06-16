import { Effect } from "effect";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { defaultSaveGameId } from "~/v0/play/save";
import { json } from "~/v0/serialization/json";
import { DevScenarioById, type DevScenarioId } from "./DevScenarioDefinitions";

export namespace loadDevScenarioFx {
	export interface Props {
		scenarioId: DevScenarioId;
	}

	export interface Result {
		scenarioId: DevScenarioId;
		boardItemCount: number;
		inventoryStackCount: number;
	}
}

const readScenario = (scenarioId: DevScenarioId) => {
	const scenario = DevScenarioById[scenarioId];
	if (!scenario) throw new Error(`Unknown dev scenario ${scenarioId}.`);
	return scenario;
};

export const loadDevScenarioFx = Effect.fn("loadDevScenarioFx")(function* ({
	scenarioId,
}: loadDevScenarioFx.Props) {
	const scenario = yield* Effect.try({
		try: () => readScenario(scenarioId),
		catch: (error) => error,
	});
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const timestamp = date.timestamp();

	yield* withTransactionFx(
		Effect.gen(function* () {
			const existing = yield* dbFx((db) =>
				db
					.selectFrom("saveGame")
					.select("id")
					.where("id", "=", defaultSaveGameId)
					.executeTakeFirst(),
			);

			if (!existing) {
				yield* dbFx((db) =>
					db
						.insertInto("saveGame")
						.values({
							id: defaultSaveGameId,
							name: "Default save",
							boardWidth: gameConfig.config.game.board.width,
							boardHeight: gameConfig.config.game.board.height,
							inventorySlots: gameConfig.config.game.inventory.slots,
							createdAt: timestamp,
							updatedAt: timestamp,
						})
						.execute(),
				);
			}

			yield* dbFx((db) =>
				db.deleteFrom("itemInstance").where("saveGameId", "=", defaultSaveGameId).execute(),
			);
			yield* dbFx((db) =>
				db
					.deleteFrom("playerUpgrade")
					.where("saveGameId", "=", defaultSaveGameId)
					.execute(),
			);

			for (const item of scenario.board) {
				yield* dbFx((db) =>
					db
						.insertInto("itemInstance")
						.values({
							id: item.id,
							saveGameId: defaultSaveGameId,
							itemDefinitionId: item.itemId,
							quantity: 1,
							locationKind: "board",
							boardX: item.x,
							boardY: item.y,
							inventorySlotIndex: null,
							ownerItemInstanceId: null,
							inputItemDefinitionId: null,
							stateJson: json(
								item.state ?? createInitialBoardState(item.itemId, gameConfig),
							),
							createdAt: timestamp,
							updatedAt: timestamp,
						})
						.execute(),
				);
			}

			for (const stack of scenario.inventory) {
				yield* dbFx((db) =>
					db
						.insertInto("itemInstance")
						.values({
							id: stack.id,
							saveGameId: defaultSaveGameId,
							itemDefinitionId: stack.itemId,
							quantity: stack.quantity,
							locationKind: "inventory",
							boardX: null,
							boardY: null,
							inventorySlotIndex: stack.slotIndex,
							ownerItemInstanceId: null,
							inputItemDefinitionId: null,
							stateJson: stack.state ? json(stack.state) : emptyInventoryStateJson,
							createdAt: timestamp,
							updatedAt: timestamp,
						})
						.execute(),
				);
			}

			yield* dbFx((db) =>
				db
					.updateTable("saveGame")
					.set({
						name: `Dev scenario: ${scenario.label}`,
						boardWidth: gameConfig.config.game.board.width,
						boardHeight: gameConfig.config.game.board.height,
						inventorySlots: gameConfig.config.game.inventory.slots,
						updatedAt: timestamp,
					})
					.where("id", "=", defaultSaveGameId)
					.execute(),
			);
		}),
	);

	return {
		scenarioId,
		boardItemCount: scenario.board.length,
		inventoryStackCount: scenario.inventory.length,
	} satisfies loadDevScenarioFx.Result;
});
