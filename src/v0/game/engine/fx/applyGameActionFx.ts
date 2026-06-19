import { Effect, type Effect as EffectType } from "effect";
import { GameConfigFx } from "~/v0/game/engine/context/GameConfigFx";
import { buildGameConfigServiceFx } from "~/v0/game/engine/fx/buildGameConfigServiceFx";
import { moveBoardItemFx } from "~/v0/game/board/moveBoardItemFx";
import { placeInventoryItemOnBoardFx } from "~/v0/game/placement/placeInventoryItemOnBoardFx";
import { stashBoardItemFx } from "~/v0/game/stash/stashBoardItemFx";
import { swapBoardItemsFx } from "~/v0/game/board/swapBoardItemsFx";
import { swapInventorySlotsFx } from "~/v0/game/inventory/swapInventorySlotsFx";
import { mergeItemFx } from "~/v0/game/merge/mergeItemFx";
import { openStashFx } from "~/v0/game/stash/openStashFx";
import { parseGameActionFx } from "~/v0/game/engine/fx/parseGameActionFx";
import { removeTileFx } from "~/v0/game/remove/removeTileFx";
import { setProducerProductLineEnabledFx } from "~/v0/game/producer/setProducerProductLineEnabledFx";
import { startCraftFx } from "~/v0/game/craft/startCraftFx";
import { storeCraftInputFx } from "~/v0/game/craft/storeCraftInputFx";
import { withdrawCraftInputFx } from "~/v0/game/craft/withdrawCraftInputFx";
import { storeProducerInputFx } from "~/v0/game/producer/storeProducerInputFx";
import { withdrawProducerInputFx } from "~/v0/game/producer/withdrawProducerInputFx";
import { startProducerProductFx } from "~/v0/game/producer/startProducerProductFx";
import { startUpgradeFx } from "~/v0/game/upgrade/startUpgradeFx";
import { storeStoredRequirementFx } from "~/v0/game/requirements/storeStoredRequirementFx";
import { withdrawStoredRequirementFx } from "~/v0/game/requirements/withdrawStoredRequirementFx";
import { matchGameAction } from "~/v0/game/engine/logic/matchGameAction";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

export namespace applyGameActionFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
		nowMs: number;
	}
}

export const applyGameActionFx = Effect.fn("applyGameActionFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: applyGameActionFx.Props) {
	const parsedAction = yield* parseGameActionFx({
		action,
	});
	const gameConfig = yield* buildGameConfigServiceFx({
		config,
		save,
	});

	const result: EffectType.Effect<
		GameEngineResult,
		GameEngineError,
		GameConfigFx | RandomServiceFx
	> = matchGameAction<
		EffectType.Effect<GameEngineResult, GameEngineError, GameConfigFx | RandomServiceFx>
	>(parsedAction, {
		boardItemMove: (moveAction) =>
			moveBoardItemFx({
				action: moveAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		boardItemStash: (stashAction) =>
			stashBoardItemFx({
				action: stashAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		boardItemsSwap: (swapAction) =>
			swapBoardItemsFx({
				action: swapAction,
				nowMs,
				save,
			}),
		craftInputStore: (storeCraftInputAction) =>
			storeCraftInputFx({
				action: storeCraftInputAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		craftInputWithdraw: (withdrawCraftInputAction) =>
			withdrawCraftInputFx({
				action: withdrawCraftInputAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		craftStart: (craftAction) =>
			startCraftFx({
				action: craftAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		inventoryItemPlace: (placeAction) =>
			placeInventoryItemOnBoardFx({
				action: placeAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		inventorySlotsSwap: (swapAction) =>
			swapInventorySlotsFx({
				action: swapAction,
				nowMs,
				save,
			}),
		itemMerge: (mergeAction) =>
			mergeItemFx({
				action: mergeAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		producerInputStore: (storeInputAction) =>
			storeProducerInputFx({
				action: storeInputAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		producerInputWithdraw: (withdrawInputAction) =>
			withdrawProducerInputFx({
				action: withdrawInputAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		producerProductLineSetEnabled: (setEnabledAction) =>
			setProducerProductLineEnabledFx({
				action: setEnabledAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		producerProductStart: (startAction) =>
			startProducerProductFx({
				action: startAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		stashOpen: (openAction) =>
			openStashFx({
				action: openAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		storedRequirementStore: (storeAction) =>
			storeStoredRequirementFx({
				action: storeAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		storedRequirementWithdraw: (withdrawAction) =>
			withdrawStoredRequirementFx({
				action: withdrawAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		tileRemove: (removeAction) =>
			removeTileFx({
				action: removeAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
		upgradeStart: (upgradeAction) =>
			startUpgradeFx({
				action: upgradeAction,
				config: gameConfig.config,
				nowMs,
				save,
			}),
	});

	return yield* Effect.provideService(result, GameConfigFx, gameConfig);
});
