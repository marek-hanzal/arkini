export type ProducerQueueSyncStep = {
	cursorAtMs: number;
	stopQueue: boolean;
};

export type ProducerJobSyncState = "paused" | "sync_timing";
