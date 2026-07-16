import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerJobStartGateReadyFx } from "~/producer/readProducerJobStartGateReadyFx";
import { readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const readProducerStartGateReadyFx = Effect.fn("readProducerStartGateReadyFx")(function* ({
	config,
	job,
	nowMs,
	realtimeProducerJobIds,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	nowMs: number;
	realtimeProducerJobIds: ReadonlySet<string>;
}) {
	const save = yield* readGameSaveDraftCurrentFx();
	return yield* readProducerJobStartGateReadyFx({
		config,
		evaluateAtMs: nowMs,
		ignoredProducerJobIds: realtimeProducerJobIds,
		job,
		save,
	});
});
