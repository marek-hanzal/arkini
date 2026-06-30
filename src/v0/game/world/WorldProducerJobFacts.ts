import type { GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

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
	producerItemInstanceId: string;
	queueIndex: number;
	releaseAtMs?: number;
	status: WorldProducerJobStatus;
}
