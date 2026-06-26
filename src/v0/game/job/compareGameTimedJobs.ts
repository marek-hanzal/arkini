import type { GameSaveCraftJob, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { compareGameReadyTimes } from "~/v0/game/time/GameTime";

type TimedJob = Pick<GameSaveProducerJob | GameSaveCraftJob, "readyAtMs" | "id">;

export namespace compareGameTimedJobs {
	export interface Props {
		left: TimedJob;
		right: TimedJob;
	}
}

export const compareGameTimedJobs = ({ left, right }: compareGameTimedJobs.Props) =>
	compareGameReadyTimes({
		left,
		right,
	});
