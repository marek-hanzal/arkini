import { Effect } from "effect";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { createCraftSpawnCompletedResult } from "~/craft/CraftJobCompletionEvents";
import type {
	CraftCompletionTarget,
	CraftJobCompletionScope,
} from "~/craft/CraftJobCompletionTypes";
import { readEffectiveOutputEntries } from "~/effects/readEffectiveOutputEntries";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const readCraftDeliveryPlacementRequestsFx = Effect.fn(
	"applyCraftCompletionResultFx.readCraftDeliveryPlacementRequestsFx",
)(function* ({ scope, target }: { scope: CraftJobCompletionScope; target: CraftCompletionTarget }) {
	const targetCell = yield* readBoardItemCellFx({
		itemInstanceId: target.liveJob.targetItemInstanceId,
		save: scope.save,
	});
	const grantIds = readGameWorldGrantIds({
		config: scope.config,
		nowMs: scope.nowMs,
		save: scope.save,
	});
	const effectiveOutput = readEffectiveOutputEntries({
		config: scope.config,
		grantIds,
		itemInstanceId: target.liveJob.targetItemInstanceId,
		lineId: `craft:${target.liveJob.recipeId}`,
		lineVisible: true,
		output: target.recipe.output,
		save: scope.save,
		targetCell,
	});
	const rolled = yield* rollEffectiveLootPlanItemsFx({
		config: scope.config,
		lootPlan: {
			baseOutput: effectiveOutput.rollableOutput,
			chanceItems: effectiveOutput.chanceItems,
			visibleOutput: effectiveOutput.visibleOutput,
		},
	});

	return rolled.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: target.liveJob.targetItemInstanceId,
				reason: "craft-result",
			}) satisfies GameSaveItemPlacementRequest,
	);
});

export const applyCraftCompletionResultFx = Effect.fn("applyCraftCompletionResultFx")(function* ({
	scope,
	target,
}: {
	scope: CraftJobCompletionScope;
	target: CraftCompletionTarget;
}) {
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

	const targetCell = yield* readBoardItemCellFx({
		itemInstanceId: target.liveJob.targetItemInstanceId,
		save: scope.save,
	});
	const placementRequests = yield* readCraftDeliveryPlacementRequestsFx({
		scope,
		target,
	});

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

	const placed = yield* placeGameSaveItemsFx({
		config: scope.config,
		freedBoardItemInstanceIds: new Set([
			target.liveJob.targetItemInstanceId,
		]),
		items: placementRequests,
		nowMs: scope.nowMs,
		save: nextSave,
		seedCell: targetCell,
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
