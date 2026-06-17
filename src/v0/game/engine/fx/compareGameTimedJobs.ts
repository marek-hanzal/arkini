import type {
	GameSaveCraftJob,
	GameSaveProducerJob,
	GameSaveUpgradeJob,
} from "~/v0/game/engine/model/GameSaveSchema";

type TimedJob = Pick<
	GameSaveProducerJob | GameSaveCraftJob | GameSaveUpgradeJob,
	"completesAtMs" | "id"
>;

export namespace compareGameTimedJobs {
	export interface Props {
		left: TimedJob;
		right: TimedJob;
	}
}

export const compareGameTimedJobs = ({ left, right }: compareGameTimedJobs.Props) =>
	left.completesAtMs - right.completesAtMs || left.id.localeCompare(right.id);
