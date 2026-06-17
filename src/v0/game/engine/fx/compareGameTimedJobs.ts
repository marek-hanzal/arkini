import type { GameSaveCraftJob, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

type TimedJob = Pick<GameSaveProducerJob | GameSaveCraftJob, "completesAtMs" | "id">;

export namespace compareGameTimedJobs {
	export interface Props {
		left: TimedJob;
		right: TimedJob;
	}
}

export const compareGameTimedJobs = (left: TimedJob, right: TimedJob) =>
	left.completesAtMs - right.completesAtMs || left.id.localeCompare(right.id);
