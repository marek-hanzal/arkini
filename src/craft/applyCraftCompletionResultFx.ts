import { Effect } from "effect";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import {
	createCraftCompletedResult,
	createCraftSpawnCompletedResult,
} from "~/craft/CraftJobCompletionEvents";
import type {
	CraftCompletionTarget,
	CraftJobCompletionScope,
} from "~/craft/CraftJobCompletionTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const readRandomBoardSeedCellFx = Effect.fn(
	"applyCraftCompletionResultFx.readRandomBoardSeedCellFx",
)(function* ({ scope }: { scope: CraftJobCompletionScope }) {
	const emptyCells = yield* planEmptyBoardCellsFx({
		config: scope.config,
		save: scope.save,
	});
	if (emptyCells.length === 0) {
		return yield* Effect.fail(
			GameEngineError.placementFailed("board:full", "Craft result has no board cell."),
		);
	}

	const random = yield* RandomServiceFx;
	return emptyCells[random.integerInclusive(0, emptyCells.length - 1)];
});

const applyReplaceTargetCraftCompletionFx = Effect.fn(
	"applyCraftCompletionResultFx.applyReplaceTargetCraftCompletionFx",
)(function* ({ scope, target }: { scope: CraftJobCompletionScope; target: CraftCompletionTarget }) {
	const nextSave = yield* cloneGameSaveFx({
		save: scope.save,
	});
	const nextTarget = nextSave.board.items[target.liveJob.targetItemInstanceId];
	if (!nextTarget) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Craft job "${target.liveJob.id}" target "${target.liveJob.targetItemInstanceId}" disappeared during completion.`,
			),
		);
	}

	yield* removeCraftJobFromSaveFx({
		jobId: target.liveJob.id,
		save: nextSave,
	});
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: target.liveJob.targetItemInstanceId,
		save: nextSave,
	});
	if (scope.config.items[target.recipe.resultItemId]?.effects?.length) {
		nextTarget.createdAtMs = scope.nowMs;
	} else {
		delete nextTarget.createdAtMs;
	}
	nextTarget.itemId = target.recipe.resultItemId;
	nextSave.updatedAtMs = scope.nowMs;

	return createCraftCompletedResult({
		fromItemId: target.liveTarget.itemId,
		job: target.liveJob,
		nowMs: scope.nowMs,
		recipe: target.recipe,
		save: nextSave,
	});
});

const applyRandomBoardCraftCompletionFx = Effect.fn(
	"applyCraftCompletionResultFx.applyRandomBoardCraftCompletionFx",
)(function* ({ scope, target }: { scope: CraftJobCompletionScope; target: CraftCompletionTarget }) {
	const nextSave = yield* cloneGameSaveFx({
		save: scope.save,
	});
	const nextTarget = nextSave.board.items[target.liveJob.targetItemInstanceId];
	if (!nextTarget) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Craft job "${target.liveJob.id}" target "${target.liveJob.targetItemInstanceId}" disappeared during completion.`,
			),
		);
	}

	yield* removeCraftJobFromSaveFx({
		jobId: target.liveJob.id,
		save: nextSave,
	});
	yield* removeBoardItemFromSaveFx({
		itemInstanceId: target.liveJob.targetItemInstanceId,
		runtimeState: "remove",
		save: nextSave,
	});
	nextSave.updatedAtMs = scope.nowMs;

	const seedCell = yield* readRandomBoardSeedCellFx({
		scope: {
			...scope,
			save: nextSave,
		},
	});
	const placed = yield* placeGameSaveItemsFx({
		config: scope.config,
		items: [
			{
				itemId: target.recipe.resultItemId,
				originItemInstanceId: target.liveJob.targetItemInstanceId,
				quantity: 1,
				reason: "craft-result",
			},
		],
		nowMs: scope.nowMs,
		save: nextSave,
		seedCell,
	});
	const events: GameEvent[] = [
		{
			atMs: scope.nowMs,
			itemId: target.liveTarget.itemId,
			itemInstanceId: target.liveJob.targetItemInstanceId,
			reason: "craft-result",
			type: "item.removed",
		},
		...placed.events,
	];

	return createCraftSpawnCompletedResult({
		events,
		job: target.liveJob,
		nowMs: scope.nowMs,
		save: placed.save,
	});
});

export const applyCraftCompletionResultFx = Effect.fn("applyCraftCompletionResultFx")(function* ({
	scope,
	target,
}: {
	scope: CraftJobCompletionScope;
	target: CraftCompletionTarget;
}) {
	return target.recipe.resultPlacement === "random-board"
		? yield* applyRandomBoardCraftCompletionFx({
				scope,
				target,
			})
		: yield* applyReplaceTargetCraftCompletionFx({
				scope,
				target,
			});
});
