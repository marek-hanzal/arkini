import { Effect } from "effect";
import type { GameActionBoardItemStashSchema } from "~/action/GameActionBoardItemStashSchema";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { placeBoardItemInInventoryFx } from "~/placement/placeBoardItemInInventoryFx";
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

const readBoardItemStashMode = ({ item, stateStatus }: BoardItemStashReadiness) =>
	stateStatus.preservable || item.itemId === boardMemoryItemId
		? "preserve-instance"
		: "stack-copy";

const readBoardItemStashStateFx = Effect.fn("stashBoardItemFx.readBoardItemStashStateFx")(
	function* ({
		action,
		config,
		save,
	}: Pick<stashBoardItemFx.Props, "action" | "config" | "save">) {
		const readiness = yield* checkBoardItemStashReadinessFx({
			action,
			config,
			save,
		});
		return {
			...readiness,
			events: [] satisfies GameEvent[],
			nextSave: yield* cloneGameSaveFx({
				save,
			}),
			stashMode: readBoardItemStashMode(readiness),
		} satisfies BoardItemStashState;
	},
);

const mapInventoryPlacementFailureFx = Effect.fn("stashBoardItemFx.mapInventoryPlacementFailureFx")(
	function* ({ reason }: { reason: Parameters<typeof GameEngineError.actionRejected>[0] }) {
		return yield* Effect.fail(GameEngineError.actionRejected(reason, "Inventory is full."));
	},
);

const placeStashedBoardItemInInventoryFx = Effect.fn(
	"stashBoardItemFx.placeStashedBoardItemInInventoryFx",
)(function* ({
	config,
	state,
}: Pick<stashBoardItemFx.Props, "config"> & {
	state: BoardItemStashState;
}) {
	const placed = yield* placeBoardItemInInventoryFx({
		config,
		events: state.events,
		item: state.item,
		mode: state.stashMode,
		reason: "board-stash",
		save: state.nextSave,
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			mapInventoryPlacementFailureFx({
				reason: error.reason,
			}),
		),
	);
	if (placed) return state.nextSave;

	return yield* mapInventoryPlacementFailureFx({
		reason: "inventory:full",
	});
});

const stashBoardItemProgramFx = Effect.fn("stashBoardItemFx.programFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: stashBoardItemFx.Props) {
	const state = yield* readBoardItemStashStateFx({
		action,
		config,
		save,
	});
	const nextSave = yield* placeStashedBoardItemInInventoryFx({
		config,
		state,
	});
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
	return yield* stashBoardItemProgramFx(props);
});
