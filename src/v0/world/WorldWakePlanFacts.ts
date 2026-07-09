import type { WorldWakeReason } from "~/world/WorldWakeReason";

export interface WorldWakePlanFacts {
	nextWakeAtMs: number | null;
	wakeReasons: WorldWakeReason[];
}
