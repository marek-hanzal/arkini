import { Effect, type Effect as EffectType } from "effect";
import { GameConfigFx } from "~/config/GameConfigFx";
import { moveBoardItemFx } from "~/board/logic/moveBoardItemFx";
import { placeInventoryItemOnBoardFx } from "~/placement/placeInventoryItemOnBoardFx";
import { stashBoardItemFx } from "~/stash/stashBoardItemFx";
import { swapBoardItemsFx } from "~/board/logic/swapBoardItemsFx";
import { swapInventorySlotsFx } from "~/inventory/logic/swapInventorySlotsFx";
import { mergeItemFx } from "~/merge/mergeItemFx";
import { openStashFx } from "~/stash/openStashFx";
import { parseGameActionFx } from "~/engine/parseGameActionFx";
import { removeTileFx } from "~/remove/removeTileFx";
import { setLineDefaultFx } from "~/producer/setLineDefaultFx";
import { setCheatSpeedModeFx } from "~/cheat/setCheatSpeedModeFx";
import { startCraftFx } from "~/craft/startCraftFx";
import { spawnDebugItemFx } from "~/debug/logic/spawnDebugItemFx";
import { storeCraftInputFx } from "~/craft/storeCraftInputFx";
import { withdrawCraftInputFx } from "~/craft/withdrawCraftInputFx";
import { storeProducerInputFx } from "~/producer/storeProducerInputFx";
import { withdrawProducerInputFx } from "~/producer/withdrawProducerInputFx";
import { startLineFx } from "~/producer/startLineFx";
import { matchGameAction } from "~/engine/logic/matchGameAction";
import { processWorldSnapshotFx } from "~/world/processWorldSnapshotFx";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { RandomServiceFx } from "~/random/context/RandomServiceFx";

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
				config,
				nowMs,
				save,
			}),
		boardItemStash: (stashAction) =>
			stashBoardItemFx({
				action: stashAction,
				config,
				nowMs,
				save,
			}),
		boardItemsSwap: (swapAction) =>
			swapBoardItemsFx({
				action: swapAction,
				config,
				nowMs,
				save,
			}),
		cheatSpeedModeSet: (setSpeedModeAction) =>
			setCheatSpeedModeFx({
				action: setSpeedModeAction,
				config,
				nowMs,
				save,
			}),
		craftInputStore: (storeCraftInputAction) =>
			storeCraftInputFx({
				action: storeCraftInputAction,
				config,
				nowMs,
				save,
			}),
		craftInputWithdraw: (withdrawCraftInputAction) =>
			withdrawCraftInputFx({
				action: withdrawCraftInputAction,
				config,
				nowMs,
				save,
			}),
		craftStart: (craftAction) =>
			startCraftFx({
				action: craftAction,
				config,
				nowMs,
				save,
			}),
		debugItemSpawn: (spawnAction) =>
			spawnDebugItemFx({
				action: spawnAction,
				config,
				nowMs,
				save,
			}),
		inventoryItemPlace: (placeAction) =>
			placeInventoryItemOnBoardFx({
				action: placeAction,
				config,
				nowMs,
				save,
			}),
		inventorySlotsSwap: (swapAction) =>
			swapInventorySlotsFx({
				action: swapAction,
				config,
				nowMs,
				save,
			}),
		itemMerge: (mergeAction) =>
			mergeItemFx({
				action: mergeAction,
				config,
				nowMs,
				save,
			}),
		producerInputStore: (storeInputAction) =>
			storeProducerInputFx({
				action: storeInputAction,
				config,
				nowMs,
				save,
			}),
		producerInputWithdraw: (withdrawInputAction) =>
			withdrawProducerInputFx({
				action: withdrawInputAction,
				config,
				nowMs,
				save,
			}),
		lineSetDefault: (setDefaultAction) =>
			setLineDefaultFx({
				action: setDefaultAction,
				config,
				nowMs,
				save,
			}),
		lineStart: (startAction) =>
			startLineFx({
				action: startAction,
				config,
				nowMs,
				save,
			}),
		stashOpen: (openAction) =>
			openStashFx({
				action: openAction,
				config,
				nowMs,
				save,
			}),
		tileRemove: (removeAction) =>
			removeTileFx({
				action: removeAction,
				config,
				nowMs,
				save,
			}),
	});

	const actionResult = yield* Effect.provideService(result, GameConfigFx, {
		config,
	});

	const processedWorld = yield* processWorldSnapshotFx({
		config,
		nowMs,
		save: actionResult.save,
	});

	return {
		events: [
			...actionResult.events,
			...processedWorld.events,
		],
		nextWakeAtMs: processedWorld.nextWakeAtMs,
		save: processedWorld.save,
	} satisfies GameEngineResult;
});
