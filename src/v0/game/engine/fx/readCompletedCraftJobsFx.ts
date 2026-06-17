import { Effect } from "effect";
import { compareGameTimedJobs } from "~/v0/game/engine/fx/compareGameTimedJobs";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readCompletedCraftJobsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readCompletedCraftJobsFx = Effect.fn("readCompletedCraftJobsFx")(function* ({
	save,
	nowMs,
}: readCompletedCraftJobsFx.Props) {
	return Object.values(save.craftJobs)
		.filter((job) => job.completesAtMs <= nowMs)
		.sort((left, right) =>
			compareGameTimedJobs({
				left,
				right,
			}),
		);
});
