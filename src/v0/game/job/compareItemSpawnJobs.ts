import type { GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";

export namespace compareItemSpawnJobs {
	export interface Props {
		left: GameSaveItemSpawnJob;
		right: GameSaveItemSpawnJob;
	}
}

export const compareItemSpawnJobs = (left: GameSaveItemSpawnJob, right: GameSaveItemSpawnJob) =>
	left.dueAtMs - right.dueAtMs || left.id.localeCompare(right.id);
