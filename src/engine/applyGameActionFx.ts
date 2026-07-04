import { Context, Effect, type Effect as EffectType } from "effect";
import { match, P } from "ts-pattern";
import type { GameAction } from "~/action/GameActionSchema";
import { moveBoardItemFx } from "~/board/logic/moveBoardItemFx";
import { swapBoardItemsFx } from "~/board/logic/swapBoardItemsFx";
import { applyBoardMemoryActivateFx } from "~/board-memory/applyBoardMemoryActivateFx";
import { applyBoardMemoryClearFx } from "~/board-memory/applyBoardMemoryClearFx";
import { setCheatSpeedModeFx } from "~/cheat/setCheatSpeedModeFx";
import { GameConfigFx } from "~/config/GameConfigFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { startCraftFx } from "~/craft/startCraftFx";
import { storeCraftInputFx } from "~/craft/storeCraftInputFx";
import { withdrawCraftInputFx } from "~/craft/withdrawCraftInputFx";
import { deleteDebugBoardItemFx } from "~/debug/logic/deleteDebugBoardItemFx";
import { spawnDebugItemFx } from "~/debug/logic/spawnDebugItemFx";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { parseGameActionFx } from "~/engine/parseGameActionFx";
import { swapInventorySlotsFx } from "~/inventory/logic/swapInventorySlotsFx";
import { mergeItemFx } from "~/merge/mergeItemFx";
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

namespace GameActionApplicationScopeFx {
	export interface Service {
		readonly config: GameConfig;
		readonly nowMs: number;
		readonly save: GameSave;
	}
}

type BoardGameAction = Extract<
	GameAction,
	{
		type:
			| "board.item.move"
			| "board.item.stash"
			| "board.memory.activate"
			| "board.memory.clear"
			| "board.items.swap"
			| "item.merge"
			| "tile.remove";
	}
>;
type BoardItemGameAction = Extract<
	BoardGameAction,
	{
		type: "board.item.move" | "board.item.stash";
	}
>;
type BoardMemoryGameAction = Extract<
	BoardGameAction,
	{
		type: "board.memory.activate" | "board.memory.clear";
	}
>;
type BoardInteractionGameAction = Extract<
	BoardGameAction,
	{
		type: "board.items.swap" | "item.merge" | "tile.remove";
	}
>;
type InventoryGameAction = Extract<
	GameAction,
	{
		type: "inventory.item.place" | "inventory.slots.swap";
	}
>;
type CraftGameAction = Extract<
	GameAction,
	{
		type: "craft.input.store" | "craft.input.withdraw" | "craft.start";
	}
>;
type ProducerGameAction = Extract<
	GameAction,
	{
		type:
			| "producer.input.store"
			| "producer.input.withdraw"
			| "line.set_default"
			| "line.start"
			| "stash.open";
	}
>;
type DebugGameAction = Extract<
	GameAction,
	{
		type: "cheat.speed_mode.set" | "debug.board_item.delete" | "debug.item.spawn";
	}
>;

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

const readGameActionContextFx = Effect.fn("applyGameActionFx.readGameActionContextFx")(
	function* () {
		return yield* GameActionApplicationScopeFx;
	},
);

const dispatchBoardItemGameActionFx = Effect.fn("applyGameActionFx.dispatchBoardItemGameActionFx")(
	function* (action: BoardItemGameAction) {
		const actionContext = yield* readGameActionContextFx();
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
			.exhaustive();
	},
);

const dispatchBoardMemoryGameActionFx = Effect.fn(
	"applyGameActionFx.dispatchBoardMemoryGameActionFx",
)(function* (action: BoardMemoryGameAction) {
	const actionContext = yield* readGameActionContextFx();
	return yield* match(action)
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
		.exhaustive();
});

const dispatchBoardInteractionGameActionFx = Effect.fn(
	"applyGameActionFx.dispatchBoardInteractionGameActionFx",
)(function* (action: BoardInteractionGameAction) {
	const actionContext = yield* readGameActionContextFx();
	return yield* match(action)
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
				type: "tile.remove",
			},
			(parsedAction) =>
				removeTileFx({
					...actionContext,
					action: parsedAction,
				}),
		)
		.exhaustive();
});

const dispatchBoardGameActionFx = Effect.fn("applyGameActionFx.dispatchBoardGameActionFx")(
	function* (action: BoardGameAction) {
		return yield* match(action)
			.with(
				{
					type: P.union("board.item.move", "board.item.stash"),
				},
				(parsedAction) => dispatchBoardItemGameActionFx(parsedAction),
			)
			.with(
				{
					type: P.union("board.memory.activate", "board.memory.clear"),
				},
				(parsedAction) => dispatchBoardMemoryGameActionFx(parsedAction),
			)
			.with(
				{
					type: P.union("board.items.swap", "item.merge", "tile.remove"),
				},
				(parsedAction) => dispatchBoardInteractionGameActionFx(parsedAction),
			)
			.exhaustive();
	},
);

const dispatchInventoryGameActionFx = Effect.fn("applyGameActionFx.dispatchInventoryGameActionFx")(
	function* (action: InventoryGameAction) {
		const actionContext = yield* readGameActionContextFx();
		return yield* match(action)
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
			.exhaustive();
	},
);

const dispatchCraftGameActionFx = Effect.fn("applyGameActionFx.dispatchCraftGameActionFx")(
	function* (action: CraftGameAction) {
		const actionContext = yield* readGameActionContextFx();
		return yield* match(action)
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
			.exhaustive();
	},
);

const dispatchProducerGameActionFx = Effect.fn("applyGameActionFx.dispatchProducerGameActionFx")(
	function* (action: ProducerGameAction) {
		const actionContext = yield* readGameActionContextFx();
		return yield* match(action)
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
			.exhaustive();
	},
);

const dispatchDebugGameActionFx = Effect.fn("applyGameActionFx.dispatchDebugGameActionFx")(
	function* (action: DebugGameAction) {
		const actionContext = yield* readGameActionContextFx();
		return yield* match(action)
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
			.exhaustive();
	},
);

const dispatchParsedGameActionFx = Effect.fn("applyGameActionFx.dispatchParsedGameActionFx")(
	function* (action: GameAction) {
		return yield* match(action)
			.with(
				{
					type: P.union(
						"board.item.move",
						"board.item.stash",
						"board.memory.activate",
						"board.memory.clear",
						"board.items.swap",
						"item.merge",
						"tile.remove",
					),
				},
				(parsedAction) => dispatchBoardGameActionFx(parsedAction),
			)
			.with(
				{
					type: P.union("inventory.item.place", "inventory.slots.swap"),
				},
				(parsedAction) => dispatchInventoryGameActionFx(parsedAction),
			)
			.with(
				{
					type: P.union("craft.input.store", "craft.input.withdraw", "craft.start"),
				},
				(parsedAction) => dispatchCraftGameActionFx(parsedAction),
			)
			.with(
				{
					type: P.union(
						"producer.input.store",
						"producer.input.withdraw",
						"line.set_default",
						"line.start",
						"stash.open",
					),
				},
				(parsedAction) => dispatchProducerGameActionFx(parsedAction),
			)
			.with(
				{
					type: P.union(
						"cheat.speed_mode.set",
						"debug.board_item.delete",
						"debug.item.spawn",
					),
				},
				(parsedAction) => dispatchDebugGameActionFx(parsedAction),
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
