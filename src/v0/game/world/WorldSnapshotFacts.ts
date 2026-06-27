import type { WorldActiveEffectFacts } from "~/v0/game/world/WorldActiveEffectFacts";
import type { WorldProducerJobFacts } from "~/v0/game/world/WorldProducerJobFacts";
import type { WorldProducerRequirementFacts } from "~/v0/game/world/WorldProducerRequirementFacts";
import type { WorldWakePlanFacts } from "~/v0/game/world/WorldWakePlanFacts";

export interface WorldSnapshotFacts {
	activeEffects: WorldActiveEffectFacts[];
	producerJobs: WorldProducerJobFacts[];
	producerRequirements: WorldProducerRequirementFacts[];
	wakePlan: WorldWakePlanFacts;
}
