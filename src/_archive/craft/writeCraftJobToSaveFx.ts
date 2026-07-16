import { Effect } from "effect";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export namespace writeCraftJobToSaveFx {
	export interface Props {
		save: GameSave;
		job: GameSaveCraftJob;
	}
}

export const writeCraftJobToSaveFx = Effect.fn("writeCraftJobToSaveFx")(function* ({
	job,
	save,
}: writeCraftJobToSaveFx.Props) {
	save.craftJobs[job.id] = job;
});
