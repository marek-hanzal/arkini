import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldProcessableJobFacts } from "~/world/readWorldProcessableJobFacts";

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
