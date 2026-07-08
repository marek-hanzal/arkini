import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	readHasPreviousNonDeliveryQueueJob,
	readRealtimeProducerJobIds,
	readSortedProducerQueue,
} from "~/producer/ProducerRealtimeQueueHelpers";
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
	config,
	nowMs,
	queue,
	realtimeProducerJobIds,
}: {
	config: GameConfig;
	nowMs: number;
	queue: readonly GameSaveProducerJob[];
	realtimeProducerJobIds: ReadonlySet<string>;
}) {
	const sortedQueue = readSortedProducerQueue(queue);
	let cursorAtMs = 0;

	for (let queueIndex = 0; queueIndex < sortedQueue.length; queueIndex += 1) {
		const job = sortedQueue[queueIndex];
		if (!job) continue;

		const step = yield* syncRealtimeProducerJobFx({
			config,
			cursorAtMs,
			hasPreviousNonDeliveryQueueJob: readHasPreviousNonDeliveryQueueJob({
				queue: sortedQueue,
				queueIndex,
			}),
			job,
			nowMs,
			realtimeProducerJobIds,
		});
		cursorAtMs = step.cursorAtMs;
		if (step.stopQueue) break;
	}
});

const syncRealtimeProducerJobsProgramFx = Effect.fn(
	"syncRealtimeProducerJobsFx.syncRealtimeProducerJobsProgramFx",
)(function* ({ config, nowMs }: Omit<syncRealtimeProducerJobsFx.Props, "save">) {
	const save = yield* readGameSaveDraftCurrentFx();
	for (const [, queue] of groupWorldProducerJobs(save)) {
		const sortedQueue = readSortedProducerQueue(queue);
		yield* syncProducerQueueFx({
			config,
			nowMs,
			queue: sortedQueue,
			realtimeProducerJobIds: readRealtimeProducerJobIds(sortedQueue),
		});
	}

	return yield* readUpdatedGameSaveDraftResultFx({
		nowMs,
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
