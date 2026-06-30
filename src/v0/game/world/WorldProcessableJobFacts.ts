import type { WorldEntityRef } from "~/v0/game/world/WorldEntityRef";
import type { WorldWakeReasonCode } from "~/v0/game/world/WorldWakeReason";

export interface WorldProcessableJobFacts {
	entity: WorldEntityRef;
	readyAtMs: number;
	reason: WorldWakeReasonCode;
}
