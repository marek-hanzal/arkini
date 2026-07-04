import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	readHasPreviousNonDeliveryQueueJob,
	readRealtimeProducerJobIds,
	readSortedProducerQueue,
} from "~/producer/ProducerRealtimeQueueHelpers";
import type {
	ProducerRealtimeQueueScope,
	ProducerRealtimeSyncScope,
} from "~/producer/ProducerRealtimeSyncTypes";
import { syncRealtimeProducerJobFx } from "~/producer/syncRealtimeProducerJobFx";
import {
	provideGameSaveDraftScopeFx,
	readGameSaveDraftCurrentFx,
	readUpdatedGameSaveDraftResultFx,
} from "~/save/GameSaveDraftScopeFx";
import { groupWorldProducerJobs } from "~/world/groupWorldProducerJobs";

export namespace syncRealtimeProducerJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const syncProducerQueueFx = Effect.fn("syncRealtimeProducerJobsFx.syncProducerQueueFx")(function* ({
	queue,
	queueScope,
	scope,
}: {
	queue: readonly GameSaveProducerJob[];
	queueScope: ProducerRealtimeQueueScope;
	scope: ProducerRealtimeSyncScope;
}) {
	const sortedQueue = readSortedProducerQueue(queue);
	let cursorAtMs = 0;

	for (let queueIndex = 0; queueIndex < sortedQueue.length; queueIndex += 1) {
		const job = sortedQueue[queueIndex];
		if (!job) continue;

		const step = yield* syncRealtimeProducerJobFx({
			cursorAtMs,
			hasPreviousNonDeliveryQueueJob: readHasPreviousNonDeliveryQueueJob({
				queue: sortedQueue,
				queueIndex,
			}),
			job,
			queueScope,
			scope,
		});
		cursorAtMs = step.cursorAtMs;
		if (step.stopQueue) break;
	}
});

const syncProducerQueueWithScopeFx = Effect.fn(
	"syncRealtimeProducerJobsFx.syncProducerQueueWithScopeFx",
)(function* ({
	queue,
	scope,
}: {
	queue: readonly GameSaveProducerJob[];
	scope: ProducerRealtimeSyncScope;
}) {
	const sortedQueue = readSortedProducerQueue(queue);
	return yield* syncProducerQueueFx({
		queue: sortedQueue,
		queueScope: {
			realtimeProducerJobIds: readRealtimeProducerJobIds(sortedQueue),
		},
		scope,
	});
});

const syncRealtimeProducerJobsProgramFx = Effect.fn(
	"syncRealtimeProducerJobsFx.syncRealtimeProducerJobsProgramFx",
)(function* (scope: ProducerRealtimeSyncScope) {
	const save = yield* readGameSaveDraftCurrentFx();
	for (const [, queue] of groupWorldProducerJobs(save)) {
		yield* syncProducerQueueWithScopeFx({
			queue,
			scope,
		});
	}

	return yield* readUpdatedGameSaveDraftResultFx({
		nowMs: scope.nowMs,
	});
});

export const syncRealtimeProducerJobsFx = Effect.fn("syncRealtimeProducerJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeProducerJobsFx.Props) {
	return yield* syncRealtimeProducerJobsProgramFx({
		config,
		nowMs,
	}).pipe((effect) =>
		provideGameSaveDraftScopeFx(effect, {
			save,
		}),
	);
});
