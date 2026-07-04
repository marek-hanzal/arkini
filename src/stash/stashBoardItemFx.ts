import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionBoardItemStashSchema } from "~/action/GameActionBoardItemStashSchema";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { placeGameSaveInventoryInstanceFx } from "~/placement/placeGameSaveInventoryInstanceFx";
import { placeGameSaveInventoryItemsFx } from "~/placement/placeGameSaveInventoryItemsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { checkBoardItemStashReadinessFx } from "~/stash/checkBoardItemStashReadinessFx";

export namespace stashBoardItemFx {
	export interface Props {
		action: GameActionBoardItemStashSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

type BoardItemStashMode = "preserve-instance" | "stack-copy";

type BoardItemStashReadiness = Effect.Effect.Success<
	ReturnType<typeof checkBoardItemStashReadinessFx>
>;

type BoardItemStashState = BoardItemStashReadiness & {
	events: GameEvent[];
	nextSave: GameSave;
	stashMode: BoardItemStashMode;
};

class BoardItemStashScopeFx extends Context.Tag("BoardItemStashScopeFx")<
	BoardItemStashScopeFx,
	stashBoardItemFx.Props
>() {
	//
}

const readBoardItemStashMode = ({ item, stateStatus }: BoardItemStashReadiness) =>
	stateStatus.preservable || item.itemId === boardMemoryItemId
		? "preserve-instance"
		: "stack-copy";

const createBoardItemStashedEvent = ({ item }: BoardItemStashReadiness) =>
	({
		from: {
			kind: "board" as const,
			itemInstanceId: item.id,
		},
		itemId: item.itemId,
		reason: "board-stash" as const,
		type: "item.consumed" as const,
	}) satisfies GameEvent;

const readBoardItemStashStateFx = Effect.fn("stashBoardItemFx.readBoardItemStashStateFx")(
	function* () {
		const { action, config, save } = yield* BoardItemStashScopeFx;
		const readiness = yield* checkBoardItemStashReadinessFx({
			action,
			config,
			save,
		});
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.board.items[readiness.item.id];

		return {
			...readiness,
			events: [
				createBoardItemStashedEvent(readiness),
			],
			nextSave,
			stashMode: readBoardItemStashMode(readiness),
		} satisfies BoardItemStashState;
	},
);

const mapInventoryPlacementFailureFx = Effect.fn("stashBoardItemFx.mapInventoryPlacementFailureFx")(
	function* ({ reason }: { reason: Parameters<typeof GameEngineError.actionRejected>[0] }) {
		return yield* Effect.fail(GameEngineError.actionRejected(reason, "Inventory is full."));
	},
);

const placePreservedBoardItemInInventoryFx = Effect.fn(
	"stashBoardItemFx.placePreservedBoardItemInInventoryFx",
)(function* (state: BoardItemStashState) {
	const { config } = yield* BoardItemStashScopeFx;
	yield* placeGameSaveInventoryInstanceFx({
		config,
		createdAtMs: state.item.createdAtMs,
		events: state.events,
		itemId: state.item.itemId,
		itemInstanceId: state.item.id,
		reason: "board-stash",
		slots: state.nextSave.inventory.slots,
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			mapInventoryPlacementFailureFx({
				reason: error.reason,
			}),
		),
	);
	return state.nextSave;
});

const placeStackedBoardItemInInventoryFx = Effect.fn(
	"stashBoardItemFx.placeStackedBoardItemInInventoryFx",
)(function* (state: BoardItemStashState) {
	const { config, nowMs } = yield* BoardItemStashScopeFx;
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: state.item.id,
		save: state.nextSave,
	});

	const placed = yield* placeGameSaveInventoryItemsFx({
		config,
		items: [
			{
				createdAtMs: state.item.createdAtMs,
				itemId: state.item.itemId,
				originItemInstanceId: state.item.id,
				quantity: 1,
				reason: "board-stash",
			},
		],
		nowMs,
		save: state.nextSave,
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			mapInventoryPlacementFailureFx({
				reason: error.reason,
			}),
		),
	);

	state.events.push(...placed.events);
	return placed.save;
});

const placeStashedBoardItemInInventoryFx = Effect.fn(
	"stashBoardItemFx.placeStashedBoardItemInInventoryFx",
)(function* (state: BoardItemStashState) {
	return yield* match(state.stashMode)
		.with("preserve-instance", () => placePreservedBoardItemInInventoryFx(state))
		.with("stack-copy", () => placeStackedBoardItemInInventoryFx(state))
		.exhaustive();
});

const stashBoardItemProgramFx = Effect.fn("stashBoardItemFx.programFx")(function* () {
	const { config, nowMs } = yield* BoardItemStashScopeFx;
	const state = yield* readBoardItemStashStateFx();
	const nextSave = yield* placeStashedBoardItemInInventoryFx(state);
	nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: state.events,
		nowMs,
		save: nextSave,
	});
});

export const stashBoardItemFx = Effect.fn("stashBoardItemFx")(function* (
	props: stashBoardItemFx.Props,
) {
	return yield* stashBoardItemProgramFx().pipe(
		Effect.provideService(BoardItemStashScopeFx, props),
	);
});
