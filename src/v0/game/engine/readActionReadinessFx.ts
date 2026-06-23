import { Effect, type Effect as EffectType } from "effect";
import { GameConfigFx } from "~/v0/game/config/GameConfigFx";
import { buildGameConfigServiceFx } from "~/v0/game/config/buildGameConfigServiceFx";
import { checkBoardItemMoveReadinessFx } from "~/v0/game/board/checkBoardItemMoveReadinessFx";
import { checkBoardItemStashReadinessFx } from "~/v0/game/stash/checkBoardItemStashReadinessFx";
import { checkBoardItemsSwapReadinessFx } from "~/v0/game/board/checkBoardItemsSwapReadinessFx";
import { checkCraftStartReadinessFx } from "~/v0/game/craft/checkCraftStartReadinessFx";
import { checkCraftInputStoreReadinessFx } from "~/v0/game/craft/checkCraftInputStoreReadinessFx";
import { checkCraftInputWithdrawReadinessFx } from "~/v0/game/craft/checkCraftInputWithdrawReadinessFx";
import { checkDebugItemSpawnReadinessFx } from "~/v0/game/debug/checkDebugItemSpawnReadinessFx";
import { checkInventoryItemPlaceReadinessFx } from "~/v0/game/placement/checkInventoryItemPlaceReadinessFx";
import { checkInventorySlotsSwapReadinessFx } from "~/v0/game/inventory/checkInventorySlotsSwapReadinessFx";
import { checkItemMergeReadinessFx } from "~/v0/game/merge/checkItemMergeReadinessFx";
import { checkProducerInputStoreReadinessFx } from "~/v0/game/producer/checkProducerInputStoreReadinessFx";
import { checkProducerInputWithdrawReadinessFx } from "~/v0/game/producer/checkProducerInputWithdrawReadinessFx";
import { checkProducerProductLineSetDefaultReadinessFx } from "~/v0/game/producer/checkProducerProductLineSetDefaultReadinessFx";
import { checkProducerProductStartReadinessFx } from "~/v0/game/producer/checkProducerProductStartReadinessFx";
import { checkStashOpenReadinessFx } from "~/v0/game/stash/checkStashOpenReadinessFx";
import { checkStoredRequirementStoreReadinessFx } from "~/v0/game/requirements/checkStoredRequirementStoreReadinessFx";
import { checkStoredRequirementWithdrawReadinessFx } from "~/v0/game/requirements/checkStoredRequirementWithdrawReadinessFx";
import { checkTileRemoveReadinessFx } from "~/v0/game/remove/checkTileRemoveReadinessFx";
import { parseGameActionFx } from "~/v0/game/engine/parseGameActionFx";
import { matchGameAction } from "~/v0/game/engine/logic/matchGameAction";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionReadiness } from "~/v0/game/action/GameActionReadinessSchema";
import type { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readActionReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
	}
}

export const readActionReadinessFx = Effect.fn("readActionReadinessFx")(function* ({
	config,
	save,
	action,
}: readActionReadinessFx.Props) {
	const gameConfig = yield* buildGameConfigServiceFx({
		config,
	});
	const readinessEffect: EffectType.Effect<void, GameEngineError, GameConfigFx> = Effect.gen(
		function* () {
			const parsedAction = yield* parseGameActionFx({
				action,
			});
			const actionReadinessEffect = matchGameAction<
				EffectType.Effect<unknown, GameEngineError, GameConfigFx>
			>(parsedAction, {
				boardItemMove: (moveAction) =>
					checkBoardItemMoveReadinessFx({
						action: moveAction,
						config: gameConfig.config,
						save,
					}),
				boardItemStash: (stashAction) =>
					checkBoardItemStashReadinessFx({
						action: stashAction,
						config: gameConfig.config,
						save,
					}),
				boardItemsSwap: (swapAction) =>
					checkBoardItemsSwapReadinessFx({
						action: swapAction,
						save,
					}),
				craftInputStore: (storeCraftInputAction) =>
					checkCraftInputStoreReadinessFx({
						action: storeCraftInputAction,
						config: gameConfig.config,
						save,
					}),
				craftInputWithdraw: (withdrawCraftInputAction) =>
					checkCraftInputWithdrawReadinessFx({
						action: withdrawCraftInputAction,
						config: gameConfig.config,
						save,
					}),
				craftStart: (craftAction) =>
					checkCraftStartReadinessFx({
						action: craftAction,
						config: gameConfig.config,
						save,
					}),
				debugItemSpawn: (spawnAction) =>
					checkDebugItemSpawnReadinessFx({
						action: spawnAction,
						config: gameConfig.config,
						save,
					}),
				inventoryItemPlace: (placeAction) =>
					checkInventoryItemPlaceReadinessFx({
						action: placeAction,
						config: gameConfig.config,
						save,
					}),
				inventorySlotsSwap: (swapAction) =>
					checkInventorySlotsSwapReadinessFx({
						action: swapAction,
						save,
					}),
				itemMerge: (mergeAction) =>
					checkItemMergeReadinessFx({
						action: mergeAction,
						config: gameConfig.config,
						save,
					}),
				producerInputStore: (storeInputAction) =>
					checkProducerInputStoreReadinessFx({
						action: storeInputAction,
						config: gameConfig.config,
						save,
					}),
				producerInputWithdraw: (withdrawInputAction) =>
					checkProducerInputWithdrawReadinessFx({
						action: withdrawInputAction,
						config: gameConfig.config,
						save,
					}),
				producerProductLineSetDefault: (setDefaultAction) =>
					checkProducerProductLineSetDefaultReadinessFx({
						action: setDefaultAction,
						config: gameConfig.config,
						save,
					}),
				producerProductStart: (startAction) =>
					checkProducerProductStartReadinessFx({
						action: startAction,
						config: gameConfig.config,
						save,
					}),
				stashOpen: (openAction) =>
					checkStashOpenReadinessFx({
						action: openAction,
						config: gameConfig.config,
						save,
					}),
				storedRequirementStore: (storeAction) =>
					checkStoredRequirementStoreReadinessFx({
						action: storeAction,
						config: gameConfig.config,
						save,
					}),
				storedRequirementWithdraw: (withdrawAction) =>
					checkStoredRequirementWithdrawReadinessFx({
						action: withdrawAction,
						config: gameConfig.config,
						save,
					}),
				tileRemove: (removeAction) =>
					checkTileRemoveReadinessFx({
						action: removeAction,
						config: gameConfig.config,
						save,
					}),
			});
			yield* actionReadinessEffect;
		},
	);

	return yield* Effect.provideService(readinessEffect, GameConfigFx, gameConfig).pipe(
		Effect.match({
			onFailure: (error: GameEngineError) =>
				({
					errorTag: error._tag,
					message: error.message,
					...(error._tag === "GameActionRejected" || error._tag === "GamePlacementFailed"
						? {
								reason: error.reason,
							}
						: {}),
					type: "rejected" as const,
				}) satisfies GameActionReadiness,
			onSuccess: () =>
				({
					type: "ready" as const,
				}) satisfies GameActionReadiness,
		}),
	);
});
