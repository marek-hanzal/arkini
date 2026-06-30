import { Effect } from "effect";
import { compareItemSpawnJobs } from "~/v0/game/job/compareItemSpawnJobs";
import { isGameTimeDue } from "~/v0/game/time/GameTime";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readDueItemSpawnJobsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readDueItemSpawnJobsFx = Effect.fn("readDueItemSpawnJobsFx")(function* ({
	save,
	nowMs,
}: readDueItemSpawnJobsFx.Props) {
	return Object.values(save.itemSpawnJobs)
		.filter((job) =>
			isGameTimeDue({
				nowMs,
				readyAtMs: job.readyAtMs,
			}),
		)
		.sort(compareItemSpawnJobs);
});
