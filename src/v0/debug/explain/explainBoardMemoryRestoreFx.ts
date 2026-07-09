import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type {
	GameDebugExplanation,
	GameDebugExplanationStep,
} from "~/debug/explain/GameDebugExplanation";
import { readGameDebugExplanationOutcome } from "~/debug/explain/readGameDebugExplanationOutcome";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { readBoardMemoryRestorePlanFx } from "~/board-memory/readBoardMemoryRestorePlanFx";
import { restoreBoardMemoryLayoutItemsFx } from "~/board-memory/restoreBoardMemoryLayoutItemsFx";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace explainBoardMemoryRestoreFx {
	export interface Props {
		boardItemId: string;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const createDryRunStateFx = Effect.fn("explainBoardMemoryRestoreFx.createDryRunStateFx")(
	function* ({ save }: Pick<explainBoardMemoryRestoreFx.Props, "save">) {
		return {
			events: [] as GameEvent[],
			nextSave: yield* cloneGameSaveFx({
				save,
			}),
		};
	},
);

const setDetails = (ids: ReadonlySet<string>) => ({
	count: ids.size,
	ids: Array.from(ids).join(","),
});

export const explainBoardMemoryRestoreFx = Effect.fn("explainBoardMemoryRestoreFx")(function* ({
	boardItemId,
	config,
	save,
}: explainBoardMemoryRestoreFx.Props) {
	const savedItems = save.boardMemoryLayouts[boardItemId]?.items;
	const steps: GameDebugExplanationStep[] = [
		{
			code: "board_memory_context",
			details: {
				boardItemId,
				boardItemCount: Object.keys(save.board.items).length,
				savedItemCount: savedItems?.length ?? 0,
			},
			message: "Explaining board memory restore.",
			status: "info",
		},
	];

	if (!savedItems) {
		steps.push({
			code: "blocked_missing_memory_layout",
			message: "No saved memory layout exists for this board memory item.",
			status: "blocked",
		});
		return {
			kind: "board-memory-restore",
			outcome: readGameDebugExplanationOutcome(steps),
			steps,
		} satisfies GameDebugExplanation<"board-memory-restore">;
	}

	const state = yield* createDryRunStateFx({
		save,
	});
	const plan = yield* readBoardMemoryRestorePlanFx({
		config,
		nextSave: state.nextSave,
		savedItems,
	});

	steps.push({
		code: "memory_preserved_board_items",
		details: setDetails(plan.fulfillmentPlan.preservedBoardItemInstanceIds),
		message: "Board-only layout items that already fulfill memory are preserved on the board.",
		status: "info",
	});

	if (!plan.canCleanBoard) {
		steps.push({
			code: "blocked_cleanup_failed",
			details: setDetails(plan.cleanupResult.failedItemInstanceIds),
			message:
				"Current board cannot be fully cleaned into inventory, so restore must not mutate save.",
			status: "blocked",
		});
		return {
			kind: "board-memory-restore",
			outcome: readGameDebugExplanationOutcome(steps),
			steps,
		} satisfies GameDebugExplanation<"board-memory-restore">;
	}

	steps.push({
		code: "accepted_cleanup",
		details: setDetails(plan.cleanupResult.storedItemInstanceIds),
		message: "Current board can be fully cleaned into inventory.",
		status: "accepted",
	});

	const storeResult = yield* storeCurrentBoardItemsInInventoryFx({
		config,
		events: state.events,
		nextSave: state.nextSave,
		preservedBoardItemInstanceIds: plan.fulfillmentPlan.preservedBoardItemInstanceIds,
	});
	if (storeResult.failedItemInstanceIds.size > 0) {
		steps.push({
			code: "blocked_cleanup_race",
			details: setDetails(storeResult.failedItemInstanceIds),
			message:
				"Dry-run cleanup succeeded, but apply cleanup failed on the explanation clone.",
			status: "blocked",
		});
		return {
			kind: "board-memory-restore",
			outcome: readGameDebugExplanationOutcome(steps),
			steps,
		} satisfies GameDebugExplanation<"board-memory-restore">;
	}

	const restoredCount = yield* restoreBoardMemoryLayoutItemsFx({
		boardMemoryItemInstanceId: boardItemId,
		config,
		events: state.events,
		nextSave: state.nextSave,
		restoredIndexes: new Set(plan.fulfillmentPlan.restoredIndexes),
		savedItems,
	});
	const skippedCount = savedItems.length - restoredCount;

	steps.push({
		code: skippedCount > 0 ? "partial_layout_restore" : "accepted_layout_restore",
		details: {
			restoredCount,
			savedItemCount: savedItems.length,
			skippedCount,
		},
		message:
			skippedCount > 0
				? "Restore can replay only the layout items that still exist after cleanup. Missing saved items are skipped."
				: "Restore can replay the full saved layout.",
		status: skippedCount > 0 ? "warning" : "accepted",
	});

	return {
		kind: "board-memory-restore",
		outcome: readGameDebugExplanationOutcome(steps),
		steps,
	} satisfies GameDebugExplanation<"board-memory-restore">;
});
