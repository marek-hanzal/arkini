import { Effect } from "effect";
import { compareGameTimedJobs } from "~/v0/game/job/compareGameTimedJobs";
import { isGameTimeDue } from "~/v0/game/time/GameTime";
import { readCraftJobWakeAtMs } from "~/v0/game/craft/craftCompletionTiming";
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
		.filter((job) =>
			isGameTimeDue({
				nowMs,
				readyAtMs: readCraftJobWakeAtMs(job),
			}),
		)
		.sort((left, right) =>
			compareGameTimedJobs({
				left,
				right,
			}),
		);
});
