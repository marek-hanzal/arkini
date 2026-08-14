import type { Effect } from "effect";

import type { PlannerProblem } from "~/editor/planner/PlannerProblem";
import type { PlannerStrategy, PlannerStrategyResult } from "~/editor/planner/PlannerStrategy";
import type {
	AnyPlannerStrategy,
	PlannerStrategyEnvironment,
} from "~/editor/planner/PlannerStrategyEnvironment";

export interface AdaptivePlannerStrategySelection {
	readonly reason: string;
	readonly strategyId: string;
}

export interface AdaptivePlannerStrategyDiagnostics {
	readonly child: {
		readonly diagnostics: unknown;
		readonly strategyId: string;
	};
	readonly selection: AdaptivePlannerStrategySelection;
}

export type AdaptivePlannerStrategyResult = PlannerStrategyResult<
	"adaptive",
	AdaptivePlannerStrategyDiagnostics
>;

export type AdaptivePlannerStrategySelector = (
	problem: PlannerProblem,
) => Effect.Effect<AdaptivePlannerStrategySelection, never, PlannerStrategyEnvironment>;

export interface AdaptivePlannerStrategy
	extends PlannerStrategy<
		"adaptive",
		AdaptivePlannerStrategyDiagnostics,
		PlannerStrategyEnvironment
	> {
	readonly childStrategyIds: ReadonlyArray<string>;
}

export interface AdaptivePlannerStrategyProps {
	readonly selectFx: AdaptivePlannerStrategySelector;
	readonly strategies: ReadonlyArray<AnyPlannerStrategy>;
}
