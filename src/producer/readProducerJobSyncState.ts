import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { ProducerJobSyncState } from "~/producer/ProducerRealtimeSyncTypes";
import { isWorldProducerJobPaused } from "~/world/readWorldProducerJobReleaseAtMs";

export const readProducerJobSyncState = ({
	job,
}: {
	job: GameSaveProducerJob;
}): ProducerJobSyncState => (isWorldProducerJobPaused(job) ? "paused" : "sync_timing");
