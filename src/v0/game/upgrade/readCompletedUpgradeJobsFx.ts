import { Effect } from "effect";
import { compareGameTimedJobs } from "~/v0/game/job/compareGameTimedJobs";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readCompletedUpgradeJobsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readCompletedUpgradeJobsFx = Effect.fn("readCompletedUpgradeJobsFx")(function* ({
	save,
	nowMs,
}: readCompletedUpgradeJobsFx.Props) {
	return Object.values(save.upgradeJobs)
		.filter((job) => job.completesAtMs <= nowMs)
		.sort((left, right) =>
			compareGameTimedJobs({
				left,
				right,
			}),
		);
});
