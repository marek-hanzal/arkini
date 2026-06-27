import type { WorldWakeReason } from "~/v0/game/world/WorldWakeReason";

export interface WorldWakePlanFacts {
	nextWakeAtMs: number | null;
	wakeReasons: WorldWakeReason[];
}
