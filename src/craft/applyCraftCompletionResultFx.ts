import { Effect } from "effect";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { createCraftCompletedResult } from "~/craft/CraftJobCompletionEvents";
import type {
	CraftCompletionTarget,
	CraftJobCompletionScope,
} from "~/craft/CraftJobCompletionTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

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
