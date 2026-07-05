import { Effect } from "effect";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type {
	ProducerRealtimeQueueScope,
	ProducerRealtimeSyncScope,
} from "~/producer/ProducerRealtimeSyncTypes";
import { readProducerJobStartGateReadyFx } from "~/producer/readProducerJobStartGateReadyFx";
import { readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const readProducerStartGateReadyFx = Effect.fn("readProducerStartGateReadyFx")(function* ({
	job,
	queueScope,
	scope,
}: {
	job: GameSaveProducerJob;
	queueScope: ProducerRealtimeQueueScope;
	scope: ProducerRealtimeSyncScope;
}) {
	const { config, nowMs } = scope;
	const { realtimeProducerJobIds } = queueScope;
	const save = yield* readGameSaveDraftCurrentFx();
	return yield* readProducerJobStartGateReadyFx({
		config,
		evaluateAtMs: nowMs,
		ignoredProducerJobIds: realtimeProducerJobIds,
		job,
		save,
	});
});
