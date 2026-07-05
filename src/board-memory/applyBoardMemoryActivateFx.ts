import { Effect } from "effect";
import { match } from "ts-pattern";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { BoardMemoryActivationProps } from "~/board-memory/BoardMemoryActivationTypes";
import type { BoardMemoryActivationScope } from "~/board-memory/BoardMemoryActivationTypes";
import { restoreSavedBoardMemoryLayoutFx } from "~/board-memory/restoreSavedBoardMemoryLayoutFx";
import { saveCurrentBoardMemoryLayoutFx } from "~/board-memory/saveCurrentBoardMemoryLayoutFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace applyBoardMemoryActivateFx {
	export interface Props extends BoardMemoryActivationProps {}
}

const readBoardMemoryActorFx = Effect.fn("applyBoardMemoryActivateFx.readBoardMemoryActorFx")(
	function* ({ scope }: { scope: BoardMemoryActivationScope }) {
		const { action, nextSave } = scope;
		const memoryItem = nextSave.board.items[action.boardItemId];
		if (memoryItem?.itemId === boardMemoryItemId) return memoryItem;

		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board memory item does not exist."),
		);
	},
);

const applyBoardMemoryActivateProgramFx = Effect.fn(
	"applyBoardMemoryActivateFx.applyBoardMemoryActivateProgramFx",
)(function* ({ scope }: { scope: BoardMemoryActivationScope }) {
	const { action, nextSave } = scope;
	yield* readBoardMemoryActorFx({
		scope,
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
		.with(
			{
				kind: "save",
			},
			() =>
				saveCurrentBoardMemoryLayoutFx({
					boardItemId: action.boardItemId,
					scope,
				}),
		)
		.with(
			{
				kind: "restore",
			},
			({ savedItems }) =>
				restoreSavedBoardMemoryLayoutFx({
					boardItemId: action.boardItemId,
					savedItems,
					scope,
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
		scope: {
			...props,
			events: [],
			nextSave,
		},
	});
});
