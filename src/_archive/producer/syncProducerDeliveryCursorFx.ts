import { Effect } from "effect";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	continueProducerQueueAt,
	stopProducerQueueAt,
} from "~/producer/ProducerRealtimeQueueHelpers";
import { readWorldProducerJobReleaseAtMs } from "~/world/readWorldProducerJobReleaseAtMs";

export const syncProducerDeliveryCursorFx = Effect.fn("syncProducerDeliveryCursorFx")(function* ({
	cursorAtMs,
	job,
}: {
	cursorAtMs: number;
	job: GameSaveProducerJob;
}) {
	const wakeAtMs = readWorldProducerJobReleaseAtMs(job);
	return wakeAtMs === undefined
		? stopProducerQueueAt(cursorAtMs)
		: continueProducerQueueAt(wakeAtMs);
});
