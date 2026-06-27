import type { WorldRequirementFacts } from "~/v0/game/world/WorldRequirementFacts";

export interface WorldProducerRequirementFacts {
	jobId: string;
	producerItemInstanceId: string;
	ready: boolean;
	requirements: WorldRequirementFacts[];
}
