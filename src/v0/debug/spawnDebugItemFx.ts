import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import { isCheatSpeedItemId, readCheatSpeedItemIdFromMode } from "~/cheat/GameCheatSpeedItem";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkDebugItemSpawnReadinessFx } from "~/debug/checkDebugItemSpawnReadinessFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

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

const readDebugSpawnItemIdFx = Effect.fn("spawnDebugItemFx.readDebugSpawnItemIdFx")(function* ({
	action,
	save,
}: Pick<spawnDebugItemFx.Props, "action" | "save">) {
	return isCheatSpeedItemId(action.itemId)
		? readCheatSpeedItemIdFromMode(
				readGameCheatSpeedMode({
					save,
				}),
			)
		: action.itemId;
});

const readDebugSpawnActionFx = Effect.fn("spawnDebugItemFx.readDebugSpawnActionFx")(function* (
	props: spawnDebugItemFx.Props,
) {
	return {
		...props.action,
		itemId: yield* readDebugSpawnItemIdFx(props),
	} satisfies DebugSpawnAction;
});

const readDebugSpawnRequestFx = Effect.fn("spawnDebugItemFx.readDebugSpawnRequestFx")(function* (
	props: spawnDebugItemFx.Props,
) {
	const action = yield* readDebugSpawnActionFx(props);

	yield* checkDebugItemSpawnReadinessFx({
		action,
		config: props.config,
		nowMs: props.nowMs,
		save: props.save,
	});

	const itemDefinition = props.config.items[action.itemId];
	if (!itemDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
		);
	}

	return {
		action,
		createdAtMs: itemDefinition.effects?.length ? props.nowMs : undefined,
		itemDefinition,
		quantity: action.quantity ?? 1,
	} satisfies DebugSpawnRequest;
});

const createDebugSpawnWorkingStateFx = Effect.fn("spawnDebugItemFx.createDebugSpawnWorkingStateFx")(
	function* (props: spawnDebugItemFx.Props) {
		return {
			...(yield* readDebugSpawnRequestFx(props)),
			events: [] as GameEvent[],
			nextSave: yield* cloneGameSaveFx({
				save: props.save,
			}),
		} satisfies DebugSpawnWorkingState;
	},
);

const assertDebugBoardHasEmptyCellFx = Effect.fn("spawnDebugItemFx.assertDebugBoardHasEmptyCellFx")(
	function* ({ props, state }: { props: spawnDebugItemFx.Props; state: DebugSpawnWorkingState }) {
		const emptyCells = yield* planEmptyBoardCellsFx({
			config: props.config,
			save: state.nextSave,
		});
		if (emptyCells.length > 0) return;

		return yield* Effect.fail(
			GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
		);
	},
);

const readDebugBoardSpawnCellFx = Effect.fn("spawnDebugItemFx.readDebugBoardSpawnCellFx")(
	function* ({ props, state }: { props: spawnDebugItemFx.Props; state: DebugSpawnWorkingState }) {
		const [emptyCell] = yield* planItemBoardPlacementCellsFx({
			config: props.config,
			itemId: state.action.itemId,
			nowMs: props.nowMs,
			save: state.nextSave,
		});
		if (emptyCell) return emptyCell;

		return yield* Effect.fail(
			GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
		);
	},
);

const spawnDebugBoardItemFx = Effect.fn("spawnDebugItemFx.spawnDebugBoardItemFx")(function* ({
	props,
	state,
}: {
	props: spawnDebugItemFx.Props;
	state: DebugSpawnWorkingState;
}) {
	yield* assertDebugBoardHasEmptyCellFx({
		props,
		state,
	});
	const cell = yield* readDebugBoardSpawnCellFx({
		props,
		state,
	});
	yield* placeBoardItemInstanceFx({
		cell,
		createdAtMs: state.createdAtMs,
		events: state.events,
		itemId: state.action.itemId,
		reason: "debug",
		save: state.nextSave,
	});
});

const spawnDebugBoardItemsFx = Effect.fn("spawnDebugItemFx.spawnDebugBoardItemsFx")(function* ({
	props,
	state,
}: {
	props: spawnDebugItemFx.Props;
	state: DebugSpawnWorkingState;
}) {
	for (let index = 0; index < state.quantity; index += 1) {
		yield* spawnDebugBoardItemFx({
			props,
			state,
		});
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
	function* ({ props, state }: { props: spawnDebugItemFx.Props; state: DebugSpawnWorkingState }) {
		return yield* match(state.action.location)
			.with("board", () =>
				spawnDebugBoardItemsFx({
					props,
					state,
				}),
			)
			.with("inventory", () => spawnDebugInventoryItemsFx(state))
			.exhaustive();
	},
);

export const spawnDebugItemFx = Effect.fn("spawnDebugItemFx")(function* (
	props: spawnDebugItemFx.Props,
) {
	const state = yield* createDebugSpawnWorkingStateFx(props);
	yield* applyDebugSpawnLocationFx({
		props,
		state,
	});
	state.nextSave.updatedAtMs = props.nowMs;

	return yield* createGameEngineResultFx({
		config: props.config,
		events: state.events,
		nowMs: props.nowMs,
		save: state.nextSave,
	});
});
