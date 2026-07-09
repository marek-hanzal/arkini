import { Effect } from "effect";
import type { BoardCell } from "~/board/BoardCellPosition";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { CraftCompletionTarget } from "~/craft/CraftJobCompletionTypes";
import { createCraftSpawnCompletedResult } from "~/craft/CraftJobCompletionEvents";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { readCraftEffectiveLootPlan } from "~/craft/readCraftEffectiveLootPlan";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const readCraftDeliveryPlacementRequestsFx = Effect.fn(
	"applyCraftCompletionResultFx.readCraftDeliveryPlacementRequestsFx",
)(function* ({
	config,
	nowMs,
	save,
	target,
	targetCell,
}: {
	config: GameConfig;
	nowMs: number;
	save: GameSave;
	target: CraftCompletionTarget;
	targetCell: BoardCell;
}) {
	const rolled = yield* rollEffectiveLootPlanItemsFx({
		lootPlan: readCraftEffectiveLootPlan({
			config,
			itemInstanceId: target.liveJob.targetItemInstanceId,
			lineId: `craft:${target.liveJob.recipeId}`,
			nowMs,
			recipe: target.recipe,
			save,
			targetCell,
		}),
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
	config,
	nowMs,
	save,
	target,
}: {
	config: GameConfig;
	nowMs: number;
	save: GameSave;
	target: CraftCompletionTarget;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save,
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
		save,
	});
	const placementRequests = yield* readCraftDeliveryPlacementRequestsFx({
		config,
		nowMs,
		save,
		target,
		targetCell,
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
	nextSave.updatedAtMs = nowMs;

	const placed = yield* placeGameSaveItemsFx({
		config,
		freedBoardItemInstanceIds: new Set([
			target.liveJob.targetItemInstanceId,
		]),
		items: placementRequests,
		nowMs,
		save: nextSave,
		seedCell: targetCell,
	});
	const events: GameEvent[] = [
		{
			atMs: nowMs,
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
		nowMs,
		save: placed.save,
	});
});
