import { Context, Effect, type Effect as EffectType } from "effect";
import { match } from "ts-pattern";
import { GameConfigFx } from "~/config/GameConfigFx";
import { moveBoardItemFx } from "~/board/logic/moveBoardItemFx";
import { applyBoardMemoryActivateFx } from "~/board-memory/applyBoardMemoryActivateFx";
import { applyBoardMemoryClearFx } from "~/board-memory/applyBoardMemoryClearFx";
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
import { deleteDebugBoardItemFx } from "~/debug/logic/deleteDebugBoardItemFx";
import { spawnDebugItemFx } from "~/debug/logic/spawnDebugItemFx";
import { storeCraftInputFx } from "~/craft/storeCraftInputFx";
import { withdrawCraftInputFx } from "~/craft/withdrawCraftInputFx";
import { storeProducerInputFx } from "~/producer/storeProducerInputFx";
import { withdrawProducerInputFx } from "~/producer/withdrawProducerInputFx";
import { startLineFx } from "~/producer/startLineFx";
import { processWorldSnapshotFx } from "~/world/processWorldSnapshotFx";
import type { GameAction } from "~/action/GameActionSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace applyGameActionFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
		nowMs: number;
	}
}

namespace GameActionApplicationScopeFx {
	export interface Service {
		readonly config: GameConfig;
		readonly nowMs: number;
		readonly save: GameSave;
	}
}

class GameActionApplicationScopeFx extends Context.Tag("GameActionApplicationScopeFx")<
	GameActionApplicationScopeFx,
	GameActionApplicationScopeFx.Service
>() {
	//
}

const provideGameActionApplicationScopeFx = <A, E, R>(
	effect: EffectType.Effect<A, E, R | GameActionApplicationScopeFx>,
	service: GameActionApplicationScopeFx.Service,
) => Effect.provideService(effect, GameActionApplicationScopeFx, service);

const dispatchParsedGameActionFx = Effect.fn("applyGameActionFx.dispatchParsedGameActionFx")(
	function* (action: GameAction) {
		const scope = yield* GameActionApplicationScopeFx;
		const actionContext = {
			config: scope.config,
			nowMs: scope.nowMs,
			save: scope.save,
		};

		return yield* match(action)
			.with(
				{
					type: "board.item.move",
				},
				(parsedAction) =>
					moveBoardItemFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.item.stash",
				},
				(parsedAction) =>
					stashBoardItemFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.memory.activate",
				},
				(parsedAction) =>
					applyBoardMemoryActivateFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.memory.clear",
				},
				(parsedAction) =>
					applyBoardMemoryClearFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.items.swap",
				},
				(parsedAction) =>
					swapBoardItemsFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "cheat.speed_mode.set",
				},
				(parsedAction) =>
					setCheatSpeedModeFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "craft.input.store",
				},
				(parsedAction) =>
					storeCraftInputFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "craft.input.withdraw",
				},
				(parsedAction) =>
					withdrawCraftInputFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "craft.start",
				},
				(parsedAction) =>
					startCraftFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "debug.board_item.delete",
				},
				(parsedAction) =>
					deleteDebugBoardItemFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "debug.item.spawn",
				},
				(parsedAction) =>
					spawnDebugItemFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "inventory.item.place",
				},
				(parsedAction) =>
					placeInventoryItemOnBoardFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "inventory.slots.swap",
				},
				(parsedAction) =>
					swapInventorySlotsFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "item.merge",
				},
				(parsedAction) =>
					mergeItemFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "producer.input.store",
				},
				(parsedAction) =>
					storeProducerInputFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "producer.input.withdraw",
				},
				(parsedAction) =>
					withdrawProducerInputFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "line.set_default",
				},
				(parsedAction) =>
					setLineDefaultFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "line.start",
				},
				(parsedAction) =>
					startLineFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "stash.open",
				},
				(parsedAction) =>
					openStashFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "tile.remove",
				},
				(parsedAction) =>
					removeTileFx({
						...actionContext,
						action: parsedAction,
					}),
			)
			.exhaustive();
	},
);

export const applyGameActionFx = Effect.fn("applyGameActionFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: applyGameActionFx.Props) {
	const parsedAction = yield* parseGameActionFx({
		action,
	});
	const scopedActionEffect = provideGameActionApplicationScopeFx(
		dispatchParsedGameActionFx(parsedAction),
		{
			config,
			nowMs,
			save,
		},
	);
	const actionResult = yield* Effect.provideService(scopedActionEffect, GameConfigFx, {
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
