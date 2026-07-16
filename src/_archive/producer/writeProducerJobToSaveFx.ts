import { Effect } from "effect";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";

export namespace writeProducerJobToSaveFx {
	export interface Props {
		save: GameSave;
		job: GameSaveProducerJob;
	}
}

export const writeProducerJobToSaveFx = Effect.fn("writeProducerJobToSaveFx")(function* ({
	job,
	save,
}: writeProducerJobToSaveFx.Props) {
	save.producerJobs[job.id] = job;
});
