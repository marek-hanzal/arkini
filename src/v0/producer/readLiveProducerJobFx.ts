import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export const readLiveProducerJobFx = Effect.fn("readLiveProducerJobFx")(function* ({
	jobId,
	save,
}: {
	jobId: string;
	save: GameSave;
}) {
	return save.producerJobs[jobId];
});
