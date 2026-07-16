import type { GameSaveProducerJob } from "~/engine/model/GameSaveShapeSchema";

export type ProducerJobEntry = {
	job: GameSaveProducerJob;
	jobId: string;
};

export type ProducerJobValidationState = {
	jobCountByItemInstanceId: Map<string, number>;
	jobsByItemInstanceId: Map<string, ProducerJobEntry[]>;
};
