import { Effect } from "effect";
import { match } from "ts-pattern";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { blockedProducerDeliveryRetryDelayMs } from "~/producer/producerDeliveryTiming";
import {
	createLineBlockedEvent,
	createLineCompletedEvent,
	createLineFailedEvent,
} from "~/producer/ProducerJobCompletionEvents";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { rescheduleProducerQueueAfterBlockedDeliveryFx } from "~/producer/rescheduleProducerQueueAfterBlockedDeliveryFx";
import { rescheduleQueueAfterCompletedProducerDeliveryFx } from "~/producer/rescheduleQueueAfterCompletedProducerDeliveryFx";
import type {
	ProducerJobCompletionScope,
	ProducerPlacementFailure,
} from "~/producer/ProducerJobCompletionTypes";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";

const completeFailedProducerDeliveryFx = Effect.fn("completeFailedProducerDeliveryFx")(function* ({
	error,
	liveJob,
	scope,
}: {
	error: ProducerPlacementFailure;
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs, save } = scope;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeProducerJobFromSaveFx({
		jobId: liveJob.id,
		save: nextSave,
	});
	yield* rescheduleQueueAfterCompletedProducerDeliveryFx({
		liveJob,
		nextSave,
		resumeAtMs: nowMs,
		scope,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			createLineCompletedEvent({
				job: liveJob,
				nowMs,
			}),
			createLineFailedEvent({
				job: liveJob,
				nowMs,
				reason: error.reason,
			}),
		],
		save: nextSave,
		type: "completed" as const,
	};
});

const completeBlockedProducerDeliveryFx = Effect.fn("completeBlockedProducerDeliveryFx")(
	function* ({
		error,
		liveJob,
		scope,
	}: {
		error: ProducerPlacementFailure;
		liveJob: GameSaveProducerJob;
		scope: ProducerJobCompletionScope;
	}) {
		const { config, nowMs, save } = scope;
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const nextAttemptAtMs = nowMs + blockedProducerDeliveryRetryDelayMs;
		yield* writeProducerJobToSaveFx({
			job: {
				...liveJob,
				delivery: {
					lastBlockedAtMs: nowMs,
					nextAttemptAtMs,
				},
			},
			save: nextSave,
		});
		yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
			blockedJobId: liveJob.id,
			config,
			nextSave,
			itemInstanceId: liveJob.itemInstanceId,
			resumeAtMs: nextAttemptAtMs,
		});
		nextSave.updatedAtMs = nowMs;

		return {
			events:
				liveJob.delivery?.lastBlockedAtMs === undefined
					? [
							createLineBlockedEvent({
								job: liveJob,
								nowMs,
								reason: error.reason,
							}),
						]
					: [],
			save: nextSave,
			type: "blocked" as const,
		};
	},
);

export const completeProducerPlacementFailureFx = Effect.fn("completeProducerPlacementFailureFx")(
	function* ({
		error,
		liveJob,
		scope,
	}: {
		error: ProducerPlacementFailure;
		liveJob: GameSaveProducerJob;
		scope: ProducerJobCompletionScope;
	}) {
		return yield* match(isGamePlacementFailureRetryable(error.reason))
			.with(false, () =>
				completeFailedProducerDeliveryFx({
					error,
					liveJob,
					scope,
				}),
			)
			.with(true, () =>
				completeBlockedProducerDeliveryFx({
					error,
					liveJob,
					scope,
				}),
			)
			.exhaustive();
	},
);
