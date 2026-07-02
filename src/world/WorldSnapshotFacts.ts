import type { WorldActiveEffectFacts } from "~/world/WorldActiveEffectFacts";
import type { WorldCraftJobFacts } from "~/world/WorldCraftJobFacts";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import type { WorldProcessableJobFacts } from "~/world/WorldProcessableJobFacts";
import type { WorldReplacementSafetyFacts } from "~/world/WorldReplacementSafetyFacts";
import type { WorldWakePlanFacts } from "~/world/WorldWakePlanFacts";

export interface WorldSnapshotFacts {
	activeEffects: WorldActiveEffectFacts[];
	craftJobs: WorldCraftJobFacts[];
	processableJobs: WorldProcessableJobFacts[];
	producerJobs: WorldProducerJobFacts[];
	replacementSafety: WorldReplacementSafetyFacts[];
	wakePlan: WorldWakePlanFacts;
}
