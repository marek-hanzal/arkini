import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readFirstProducerQueueJobs } from "~/v0/game/producer/readFirstProducerQueueJobs";
import { readProducerJobWakeAtMs } from "~/v0/game/producer/producerDeliveryTiming";

export const readProducerQueueWakeAtMsValues = (save: GameSave) =>
	readFirstProducerQueueJobs(save).map(readProducerJobWakeAtMs);
