import type { Effect } from "effect";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import type { PlannerCoverageAuditProgress } from "~/editor/planner/PlannerCoverageAudit";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export interface PlannerCoverageAuditRequest {
	readonly budget?: Partial<PlannerSearchBudget>;
	readonly config: GameConfigSchema.Type;
	readonly itemIds?: ReadonlyArray<IdSchema.Type>;
	readonly onProgress?: (progress: PlannerCoverageAuditProgress) => Effect.Effect<void>;
	readonly quantity?: number;
}
