import type { GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";

export type WorldCraftJobStatus = "delivery_blocked" | "ready" | "running";

export interface WorldCraftJobFacts {
	job: GameSaveCraftJob;
	releaseAtMs: number;
	status: WorldCraftJobStatus;
}
