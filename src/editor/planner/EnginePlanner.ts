import type { Effect } from "effect";

import type { Planner } from "~/editor/planner/Planner";
import type {
	PlannerGoalSearchBudget,
	PlannerGoalSearchResult,
} from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearch } from "~/editor/planner/PlannerSearch";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * Compatibility facade over the planner orchestrator.
 *
 * New orchestration belongs to `Planner.estimateFx`; explicit search methods remain while the
 * editor and audit surfaces migrate to strategy-neutral results.
 */
export interface EnginePlanner extends Planner, PlannerSearch {
	readonly constructiveSearchFx: (
		itemId: IdSchema.Type,
		quantity?: number,
		budget?: Partial<PlannerGoalSearchBudget>,
	) => Effect.Effect<PlannerGoalSearchResult>;
}
