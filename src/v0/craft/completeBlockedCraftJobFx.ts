import { Effect } from "effect";
import { match } from "ts-pattern";
import { blockedCraftCompletionRetryDelayMs } from "~/craft/craftCompletionTiming";
import { createCraftBlockedEvent, createCraftFailedEvent } from "~/craft/CraftJobCompletionEvents";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { writeCraftJobToSaveFx } from "~/craft/writeCraftJobToSaveFx";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const createFailedCraftCompletionFx = Effect.fn("createFailedCraftCompletionFx")(function* ({
	job,
	nowMs,
	reason,
	save,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
	save: GameSave;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeCraftJobFromSaveFx({
		jobId: job.id,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			createCraftFailedEvent({
				job,
				nowMs,
				reason,
			}),
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

const createRetryingCraftCompletionFx = Effect.fn("createRetryingCraftCompletionFx")(function* ({
	job,
	nowMs,
	reason,
	save,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
	save: GameSave;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const nextAttemptAtMs = nowMs + blockedCraftCompletionRetryDelayMs;
	yield* writeCraftJobToSaveFx({
		job: {
			...job,
			delivery: {
				lastBlockedAtMs: nowMs,
				nextAttemptAtMs,
			},
		},
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events:
			job.delivery?.lastBlockedAtMs === undefined
				? [
						createCraftBlockedEvent({
							job,
							nowMs,
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
	nowMs,
	reason,
	save,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
	save: GameSave;
}) {
	return yield* match(isGamePlacementFailureRetryable(reason))
		.with(false, () =>
			createFailedCraftCompletionFx({
				job,
				nowMs,
				reason,
				save,
			}),
		)
		.with(true, () =>
			createRetryingCraftCompletionFx({
				job,
				nowMs,
				reason,
				save,
			}),
		)
		.exhaustive();
});
