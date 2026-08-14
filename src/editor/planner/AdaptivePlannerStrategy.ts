import type { Effect } from "effect";

import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerBudgetLimits, PlannerBudgetSnapshot } from "~/editor/planner/PlannerBudget";
import type { PlannerCurrentStrategyFxService } from "~/editor/planner/PlannerCurrentStrategyFx";
import type { PlannerGoalViability } from "~/editor/planner/PlannerGoalViability";
import type { PlannerProblem } from "~/editor/planner/PlannerProblem";
import type { PlannerStrategy, PlannerStrategyResult } from "~/editor/planner/PlannerStrategy";
import type {
	AnyPlannerStrategy,
	PlannerStrategyEnvironment,
} from "~/editor/planner/PlannerStrategyEnvironment";

export interface AdaptivePlannerStrategySelection<StrategyId extends string = string> {
	readonly reason: string;
	readonly strategyId: StrategyId;
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

/** Stable facts available when a composite strategy chooses one child algorithm. */
export interface AdaptivePlannerStrategySituation {
	readonly budget: {
		readonly limits: PlannerBudgetLimits;
		readonly snapshot: PlannerBudgetSnapshot;
	};
	readonly currentStrategy: PlannerCurrentStrategyFxService;
	readonly goalViability: PlannerGoalViability;
	readonly graph: PlannerAcquisitionGraph;
	readonly problem: PlannerProblem;
}

export type AdaptivePlannerStrategySelector<StrategyId extends string = string> = (
	situation: AdaptivePlannerStrategySituation,
) => Effect.Effect<AdaptivePlannerStrategySelection<StrategyId>>;

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
