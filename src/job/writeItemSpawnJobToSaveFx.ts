import { Effect } from "effect";
import type { GameSave, GameSaveItemSpawnJob } from "~/engine/model/GameSaveSchema";

export namespace writeItemSpawnJobToSaveFx {
	export interface Props {
		save: GameSave;
		job: GameSaveItemSpawnJob;
	}
}

export const writeItemSpawnJobToSaveFx = Effect.fn("writeItemSpawnJobToSaveFx")(function* ({
	job,
	save,
}: writeItemSpawnJobToSaveFx.Props) {
	save.itemSpawnJobs[job.id] = job;
});
