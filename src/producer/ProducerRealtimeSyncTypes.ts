import type { GameConfig } from "~/config/GameConfigTypes";

export type ProducerQueueSyncStep = {
	cursorAtMs: number;
	stopQueue: boolean;
};

export type ProducerJobSyncState = "paused" | "sync_timing";

export type ProducerRealtimeSyncScope = {
	readonly config: GameConfig;
	readonly nowMs: number;
};

export type ProducerRealtimeQueueScope = {
	readonly realtimeProducerJobIds: ReadonlySet<string>;
};
