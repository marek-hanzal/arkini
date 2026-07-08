import { Effect } from "effect";
import { match } from "ts-pattern";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type {
	BoardMemoryActivationProps,
	BoardMemoryActivationState,
} from "~/board-memory/BoardMemoryActivationTypes";
import { restoreSavedBoardMemoryLayoutFx } from "~/board-memory/restoreSavedBoardMemoryLayoutFx";
import { saveCurrentBoardMemoryLayoutFx } from "~/board-memory/saveCurrentBoardMemoryLayoutFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace applyBoardMemoryActivateFx {
	export interface Props extends BoardMemoryActivationProps {}
}

const readBoardMemoryActorFx = Effect.fn("applyBoardMemoryActivateFx.readBoardMemoryActorFx")(
	function* ({
		action,
		nextSave,
	}: Pick<BoardMemoryActivationProps, "action"> & Pick<BoardMemoryActivationState, "nextSave">) {
		const memoryItem = nextSave.board.items[action.boardItemId];
		if (memoryItem?.itemId === boardMemoryItemId) return memoryItem;

		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board memory item does not exist."),
		);
	},
);

const applyBoardMemoryActivateProgramFx = Effect.fn(
	"applyBoardMemoryActivateFx.applyBoardMemoryActivateProgramFx",
)(function* ({
	action,
	config,
	events,
	nextSave,
	nowMs,
}: Pick<BoardMemoryActivationProps, "action" | "config" | "nowMs"> & BoardMemoryActivationState) {
	yield* readBoardMemoryActorFx({
		action,
		nextSave,
	});
	const savedLayout = nextSave.boardMemoryLayouts[action.boardItemId];
	const activationRoute = savedLayout
		? ({
				kind: "restore",
				savedItems: savedLayout.items,
			} as const)
		: ({
				kind: "save",
			} as const);

	return yield* match(activationRoute)
		.with({ kind: "save" }, () =>
			saveCurrentBoardMemoryLayoutFx({
				boardItemId: action.boardItemId,
				config,
				events,
				nextSave,
				nowMs,
			}),
		)
		.with({ kind: "restore" }, ({ savedItems }) =>
			restoreSavedBoardMemoryLayoutFx({
				boardItemId: action.boardItemId,
				config,
				events,
				nextSave,
				nowMs,
				savedItems,
			}),
		)
		.exhaustive();
});

export const applyBoardMemoryActivateFx = Effect.fn("applyBoardMemoryActivateFx")(function* (
	props: applyBoardMemoryActivateFx.Props,
) {
	const nextSave = yield* cloneGameSaveFx({
		save: props.save,
	});

	return yield* applyBoardMemoryActivateProgramFx({
		action: props.action,
		config: props.config,
		events: [],
		nextSave,
		nowMs: props.nowMs,
	});
});
