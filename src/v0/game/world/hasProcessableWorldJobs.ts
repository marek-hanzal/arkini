import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldProcessableJobFacts } from "~/v0/game/world/readWorldProcessableJobFacts";

export namespace hasProcessableWorldJobs {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const hasProcessableWorldJobs = ({ config, nowMs, save }: hasProcessableWorldJobs.Props) =>
	readWorldProcessableJobFacts({
		config,
		nowMs,
		save,
	}).length > 0;
