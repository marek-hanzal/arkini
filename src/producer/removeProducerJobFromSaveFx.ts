import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeProducerJobFromSaveFx {
	export interface Props {
		save: GameSave;
		jobId: string;
	}
}

export const removeProducerJobFromSaveFx = Effect.fn("removeProducerJobFromSaveFx")(function* ({
	jobId,
	save,
}: removeProducerJobFromSaveFx.Props) {
	delete save.producerJobs[jobId];
});
