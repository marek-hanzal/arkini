import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import { isCheatSpeedItemId, readCheatSpeedItemIdFromMode } from "~/cheat/GameCheatSpeedItem";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { checkDebugItemSpawnReadinessFx } from "~/debug/checkDebugItemSpawnReadinessFx";

export namespace spawnDebugItemFx {
	export interface Props {
		action: GameActionDebugItemSpawnSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

type DebugSpawnAction = GameActionDebugItemSpawnSchema.Type;

type DebugSpawnRequest = {
	action: DebugSpawnAction;
	createdAtMs: number | undefined;
	itemDefinition: NonNullable<GameConfig["items"][string]>;
	quantity: number;
};

type DebugSpawnWorkingState = DebugSpawnRequest & {
	events: GameEvent[];
	nextSave: GameSave;
};

class DebugItemSpawnScopeFx extends Context.Tag("DebugItemSpawnScopeFx")<
	DebugItemSpawnScopeFx,
	spawnDebugItemFx.Props
>() {
	//
}

const readDebugSpawnItemIdFx = Effect.fn("spawnDebugItemFx.readDebugSpawnItemIdFx")(function* () {
	const { action, save } = yield* DebugItemSpawnScopeFx;
	return isCheatSpeedItemId(action.itemId)
		? readCheatSpeedItemIdFromMode(
				readGameCheatSpeedMode({
					save,
				}),
			)
		: action.itemId;
});

const readDebugSpawnActionFx = Effect.fn("spawnDebugItemFx.readDebugSpawnActionFx")(function* () {
	const { action } = yield* DebugItemSpawnScopeFx;
	return {
		...action,
		itemId: yield* readDebugSpawnItemIdFx(),
	} satisfies DebugSpawnAction;
});

const readDebugSpawnRequestFx = Effect.fn("spawnDebugItemFx.readDebugSpawnRequestFx")(function* () {
	const { config, nowMs, save } = yield* DebugItemSpawnScopeFx;
	const action = yield* readDebugSpawnActionFx();

	yield* checkDebugItemSpawnReadinessFx({
		action,
		config,
		nowMs,
		save,
	});

	const itemDefinition = config.items[action.itemId];
	if (!itemDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
		);
	}

	return {
		action,
		createdAtMs: itemDefinition.effects?.length ? nowMs : undefined,
		itemDefinition,
		quantity: action.quantity ?? 1,
	} satisfies DebugSpawnRequest;
});

const createDebugSpawnWorkingStateFx = Effect.fn("spawnDebugItemFx.createDebugSpawnWorkingStateFx")(
	function* () {
		const { save } = yield* DebugItemSpawnScopeFx;
		return {
			...(yield* readDebugSpawnRequestFx()),
			events: [] as GameEvent[],
			nextSave: yield* cloneGameSaveFx({
				save,
			}),
		} satisfies DebugSpawnWorkingState;
	},
);

const assertDebugBoardHasEmptyCellFx = Effect.fn("spawnDebugItemFx.assertDebugBoardHasEmptyCellFx")(
	function* ({ nextSave }: DebugSpawnWorkingState) {
		const { config } = yield* DebugItemSpawnScopeFx;
		const emptyCells = yield* planEmptyBoardCellsFx({
			config,
			save: nextSave,
		});
		if (emptyCells.length > 0) return;

		return yield* Effect.fail(
			GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
		);
	},
);

const readDebugBoardSpawnCellFx = Effect.fn("spawnDebugItemFx.readDebugBoardSpawnCellFx")(
	function* ({ action, nextSave }: DebugSpawnWorkingState) {
		const { config, nowMs } = yield* DebugItemSpawnScopeFx;
		const [emptyCell] = yield* planItemBoardPlacementCellsFx({
			config,
			itemId: action.itemId,
			nowMs,
			save: nextSave,
		});
		if (emptyCell) return emptyCell;

		return yield* Effect.fail(
			GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
		);
	},
);

const spawnDebugBoardItemFx = Effect.fn("spawnDebugItemFx.spawnDebugBoardItemFx")(function* (
	state: DebugSpawnWorkingState,
) {
	yield* assertDebugBoardHasEmptyCellFx(state);
	const cell = yield* readDebugBoardSpawnCellFx(state);
	yield* placeBoardItemInstanceFx({
		cell,
		createdAtMs: state.createdAtMs,
		events: state.events,
		itemId: state.action.itemId,
		reason: "debug",
		save: state.nextSave,
	});
});

const spawnDebugBoardItemsFx = Effect.fn("spawnDebugItemFx.spawnDebugBoardItemsFx")(function* (
	state: DebugSpawnWorkingState,
) {
	for (let index = 0; index < state.quantity; index += 1) {
		yield* spawnDebugBoardItemFx(state);
	}
});

const spawnDebugInventoryItemsFx = Effect.fn("spawnDebugItemFx.spawnDebugInventoryItemsFx")(
	function* (state: DebugSpawnWorkingState) {
		const placed = yield* placeGameSaveInventoryRemainderFx({
			createdAtMs: state.createdAtMs,
			events: state.events,
			item: {
				itemId: state.action.itemId,
				quantity: state.quantity,
				reason: "debug",
			},
			maxStackSize: state.itemDefinition.maxStackSize,
			remainingQuantity: state.quantity,
			slots: state.nextSave.inventory.slots,
		});

		if (placed) return;
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"inventory:full",
				"Inventory has no space for debug item.",
			),
		);
	},
);

const applyDebugSpawnLocationFx = Effect.fn("spawnDebugItemFx.applyDebugSpawnLocationFx")(
	function* (state: DebugSpawnWorkingState) {
		return yield* match(state.action.location)
			.with("board", () => spawnDebugBoardItemsFx(state))
			.with("inventory", () => spawnDebugInventoryItemsFx(state))
			.exhaustive();
	},
);

const spawnDebugItemProgramFx = Effect.fn("spawnDebugItemFx.programFx")(function* () {
	const { config, nowMs } = yield* DebugItemSpawnScopeFx;
	const state = yield* createDebugSpawnWorkingStateFx();
	yield* applyDebugSpawnLocationFx(state);
	state.nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: state.events,
		nowMs,
		save: state.nextSave,
	});
});

export const spawnDebugItemFx = Effect.fn("spawnDebugItemFx")(function* (
	props: spawnDebugItemFx.Props,
) {
	return yield* spawnDebugItemProgramFx().pipe(
		Effect.provideService(DebugItemSpawnScopeFx, props),
	);
});
