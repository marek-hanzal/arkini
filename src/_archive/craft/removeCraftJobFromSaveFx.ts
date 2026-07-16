import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeCraftJobFromSaveFx {
	export interface Props {
		save: GameSave;
		jobId: string;
	}
}

export const removeCraftJobFromSaveFx = Effect.fn("removeCraftJobFromSaveFx")(function* ({
	jobId,
	save,
}: removeCraftJobFromSaveFx.Props) {
	delete save.craftJobs[jobId];
});
