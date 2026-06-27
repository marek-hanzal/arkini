import type { WorldActiveEffectFacts } from "~/v0/game/world/WorldActiveEffectFacts";
import type { WorldCraftJobFacts } from "~/v0/game/world/WorldCraftJobFacts";
import type { WorldProducerJobFacts } from "~/v0/game/world/WorldProducerJobFacts";
import type { WorldProcessableJobFacts } from "~/v0/game/world/WorldProcessableJobFacts";
import type { WorldProducerRequirementFacts } from "~/v0/game/world/WorldProducerRequirementFacts";
import type { WorldReplacementSafetyFacts } from "~/v0/game/world/WorldReplacementSafetyFacts";
import type { WorldWakePlanFacts } from "~/v0/game/world/WorldWakePlanFacts";

export interface WorldSnapshotFacts {
	activeEffects: WorldActiveEffectFacts[];
	craftJobs: WorldCraftJobFacts[];
	processableJobs: WorldProcessableJobFacts[];
	producerJobs: WorldProducerJobFacts[];
	producerRequirements: WorldProducerRequirementFacts[];
	replacementSafety: WorldReplacementSafetyFacts[];
	wakePlan: WorldWakePlanFacts;
}
