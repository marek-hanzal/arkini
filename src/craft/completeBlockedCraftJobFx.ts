import { Effect } from "effect";
import { match } from "ts-pattern";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { blockedCraftCompletionRetryDelayMs } from "~/craft/craftCompletionTiming";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { writeCraftJobToSaveFx } from "~/craft/writeCraftJobToSaveFx";
import { createCraftBlockedEvent, createCraftFailedEvent } from "~/craft/CraftJobCompletionEvents";
import type { CraftJobCompletionScope } from "~/craft/CraftJobCompletionTypes";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";

const createFailedCraftCompletionFx = Effect.fn("createFailedCraftCompletionFx")(function* ({
	job,
	reason,
	scope,
}: {
	job: GameSaveCraftJob;
	reason: GamePlacementFailureReason;
	scope: CraftJobCompletionScope;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save: scope.save,
	});
	yield* removeCraftJobFromSaveFx({
		jobId: job.id,
		save: nextSave,
	});
	nextSave.updatedAtMs = scope.nowMs;

	return {
		events: [
			createCraftFailedEvent({
				job,
				nowMs: scope.nowMs,
				reason,
			}),
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

const createRetryingCraftCompletionFx = Effect.fn("createRetryingCraftCompletionFx")(function* ({
	job,
	reason,
	scope,
}: {
	job: GameSaveCraftJob;
	reason: GamePlacementFailureReason;
	scope: CraftJobCompletionScope;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save: scope.save,
	});
	const nextAttemptAtMs = scope.nowMs + blockedCraftCompletionRetryDelayMs;
	yield* writeCraftJobToSaveFx({
		job: {
			...job,
			delivery: {
				lastBlockedAtMs: scope.nowMs,
				nextAttemptAtMs,
			},
		},
		save: nextSave,
	});
	nextSave.updatedAtMs = scope.nowMs;

	return {
		events:
			job.delivery?.lastBlockedAtMs === undefined
				? [
						createCraftBlockedEvent({
							job,
							nowMs: scope.nowMs,
							reason,
						}),
					]
				: [],
		save: nextSave,
		type: "blocked" as const,
	} satisfies GameEngineCompletionResult;
});

export const completeBlockedCraftJobFx = Effect.fn("completeBlockedCraftJobFx")(function* ({
	job,
	reason,
	scope,
}: {
	job: GameSaveCraftJob;
	reason: GamePlacementFailureReason;
	scope: CraftJobCompletionScope;
}) {
	return yield* match(isGamePlacementFailureRetryable(reason))
		.with(false, () =>
			createFailedCraftCompletionFx({
				job,
				reason,
				scope,
			}),
		)
		.with(true, () =>
			createRetryingCraftCompletionFx({
				job,
				reason,
				scope,
			}),
		)
		.exhaustive();
});
