import type { Effect } from "effect";

import type {
	PlannerSearchBudget,
	PlannerSearchDiagnostics,
	PlannerSearchResult,
} from "~/editor/planner/PlannerSearch";
import type {
	PlannerStrategy,
	PlannerStrategyRequest,
	PlannerStrategyResult,
} from "~/editor/planner/PlannerStrategy";

export type BestFirstPlannerStrategyResult = PlannerStrategyResult<
	"best-first",
	PlannerSearchDiagnostics
>;

/** Established global best-first runtime search, exposed through the common strategy contract. */
export interface BestFirstPlannerStrategy
	extends PlannerStrategy<"best-first", PlannerSearchBudget, PlannerSearchDiagnostics> {
	readonly searchFx: (
		request: PlannerStrategyRequest,
		budget?: Partial<PlannerSearchBudget>,
	) => Effect.Effect<PlannerSearchResult>;
}
