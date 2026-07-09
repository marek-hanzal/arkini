import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeItemSpawnJobFromSaveFx {
	export interface Props {
		save: GameSave;
		jobId: string;
	}
}

export const removeItemSpawnJobFromSaveFx = Effect.fn("removeItemSpawnJobFromSaveFx")(function* ({
	jobId,
	save,
}: removeItemSpawnJobFromSaveFx.Props) {
	delete save.itemSpawnJobs[jobId];
});
