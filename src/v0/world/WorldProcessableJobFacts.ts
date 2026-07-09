import type { WorldEntityRef } from "~/world/WorldEntityRef";
import type { WorldWakeReasonCode } from "~/world/WorldWakeReason";

export interface WorldProcessableJobFacts {
	entity: WorldEntityRef;
	readyAtMs: number;
	reason: WorldWakeReasonCode;
}
