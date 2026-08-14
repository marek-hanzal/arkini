import type { Effect } from "effect";

import type {
	PlannerGoalSearchBudget,
	PlannerGoalSearchResult,
} from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearch } from "~/editor/planner/PlannerSearch";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Reusable planner exposing the established global search and the constructive goal-stack search. */
export interface EnginePlanner extends PlannerSearch {
	readonly constructiveSearchFx: (
		itemId: IdSchema.Type,
		quantity?: number,
		budget?: Partial<PlannerGoalSearchBudget>,
	) => Effect.Effect<PlannerGoalSearchResult>;
}
