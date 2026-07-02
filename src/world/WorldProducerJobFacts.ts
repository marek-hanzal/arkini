import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";

type WorldProducerJobStatus =
	| "blocked_by_paused_queue_head"
	| "delivery_blocked"
	| "paused"
	| "queued"
	| "ready"
	| "running";

export interface WorldProducerJobFacts {
	job: GameSaveProducerJob;
	previousJobId?: string;
	itemInstanceId: string;
	queueIndex: number;
	releaseAtMs?: number;
	status: WorldProducerJobStatus;
}
