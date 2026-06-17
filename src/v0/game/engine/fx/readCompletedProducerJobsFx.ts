import { Effect } from "effect";
import { compareGameTimedJobs } from "~/v0/game/engine/fx/compareGameTimedJobs";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readCompletedProducerJobsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readCompletedProducerJobsFx = Effect.fn("readCompletedProducerJobsFx")(function* ({
	save,
	nowMs,
}: readCompletedProducerJobsFx.Props) {
	return Object.values(save.producerJobs)
		.filter((job) => job.completesAtMs <= nowMs)
		.sort(compareGameTimedJobs);
});
