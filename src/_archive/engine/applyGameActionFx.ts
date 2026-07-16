import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameAction } from "~/action/GameActionSchema";
import { applyBoardMemoryActivateFx } from "~/board-memory/applyBoardMemoryActivateFx";
import { applyBoardMemoryClearFx } from "~/board-memory/applyBoardMemoryClearFx";
import { moveBoardItemFx } from "~/board/moveBoardItemFx";
import { swapBoardItemsFx } from "~/board/swapBoardItemsFx";
import { setCheatSpeedModeFx } from "~/cheat/setCheatSpeedModeFx";
import { GameConfigFx } from "~/config/GameConfigFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { startCraftFx } from "~/craft/startCraftFx";
import { storeCraftInputFx } from "~/craft/storeCraftInputFx";
import { withdrawCraftInputFx } from "~/craft/withdrawCraftInputFx";
import { deleteDebugBoardItemFx } from "~/debug/deleteDebugBoardItemFx";
import { spawnDebugItemFx } from "~/debug/spawnDebugItemFx";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { parseGameActionFx } from "~/engine/parseGameActionFx";
import { swapInventorySlotsFx } from "~/inventory/swapInventorySlotsFx";
import { mergeItemFx } from "~/merge/mergeItemFx";
import { stackItemFx } from "~/stack/stackItemFx";
import { placeInventoryItemOnBoardFx } from "~/placement/placeInventoryItemOnBoardFx";
import { removeTileFx } from "~/remove/removeTileFx";
import { setLineDefaultFx } from "~/producer/setLineDefaultFx";
import { startLineFx } from "~/producer/startLineFx";
import { storeProducerInputFx } from "~/producer/storeProducerInputFx";
import { withdrawProducerInputFx } from "~/producer/withdrawProducerInputFx";
import { openStashFx } from "~/stash/openStashFx";
import { stashBoardItemFx } from "~/stash/stashBoardItemFx";
import { processWorldSnapshotFx } from "~/world/processWorldSnapshotFx";

export namespace applyGameActionFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
		nowMs: number;
	}
}

type GameActionContext = Omit<applyGameActionFx.Props, "action">;

const dispatchParsedGameActionFx = Effect.fn("applyGameActionFx.dispatchParsedGameActionFx")(
	function* ({ action, context }: { action: GameAction; context: GameActionContext }) {
		return yield* match(action)
			.with(
				{
					type: "board.item.move",
				},
				(parsedAction) =>
					moveBoardItemFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.item.stash",
				},
				(parsedAction) =>
					stashBoardItemFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.memory.activate",
				},
				(parsedAction) =>
					applyBoardMemoryActivateFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.memory.clear",
				},
				(parsedAction) =>
					applyBoardMemoryClearFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "board.items.swap",
				},
				(parsedAction) =>
					swapBoardItemsFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "item.merge",
				},
				(parsedAction) =>
					mergeItemFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "item.stack",
				},
				(parsedAction) =>
					stackItemFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "tile.remove",
				},
				(parsedAction) =>
					removeTileFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "inventory.item.place",
				},
				(parsedAction) =>
					placeInventoryItemOnBoardFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "inventory.slots.swap",
				},
				(parsedAction) =>
					swapInventorySlotsFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "craft.input.store",
				},
				(parsedAction) =>
					storeCraftInputFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "craft.input.withdraw",
				},
				(parsedAction) =>
					withdrawCraftInputFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "craft.start",
				},
				(parsedAction) =>
					startCraftFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "producer.input.store",
				},
				(parsedAction) =>
					storeProducerInputFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "producer.input.withdraw",
				},
				(parsedAction) =>
					withdrawProducerInputFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "line.set_default",
				},
				(parsedAction) =>
					setLineDefaultFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "line.start",
				},
				(parsedAction) =>
					startLineFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "stash.open",
				},
				(parsedAction) =>
					openStashFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "cheat.speed_mode.set",
				},
				(parsedAction) =>
					setCheatSpeedModeFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "debug.board_item.delete",
				},
				(parsedAction) =>
					deleteDebugBoardItemFx({
						...context,
						action: parsedAction,
					}),
			)
			.with(
				{
					type: "debug.item.spawn",
				},
				(parsedAction) =>
					spawnDebugItemFx({
						...context,
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
	const actionResult = yield* dispatchParsedGameActionFx({
		action: parsedAction,
		context: {
			config,
			nowMs,
			save,
		},
	}).pipe(
		Effect.provideService(GameConfigFx, {
			config,
		}),
	);

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
