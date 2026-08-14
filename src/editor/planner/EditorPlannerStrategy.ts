import type { AdaptivePlannerStrategySelection } from "~/editor/planner/AdaptivePlannerStrategy";
import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import type {
	PlannerStrategy,
	PlannerStrategyMetrics,
	PlannerStrategyResult,
} from "~/editor/planner/PlannerStrategy";
import type { PlannerStrategyEnvironment } from "~/editor/planner/PlannerStrategyEnvironment";

export interface EditorPlannerStrategyPolicy {
	readonly maximumBestFirstDepth: number;
	readonly maximumConstructiveDelegationDepth: number;
	readonly maximumConstructiveLinearRootDepth: number;
	readonly maximumConstructiveMergeRootDepth: number;
}

export interface EditorPlannerStrategyAttemptDiagnostic {
	readonly diagnostics: unknown;
	readonly index: number;
	readonly metrics: PlannerStrategyMetrics;
	readonly outcome: "completed" | "inconclusive" | "no-finite-path";
	readonly strategyId: string;
}

export type EditorPlannerStrategyMode =
	| "selected-best-first"
	| "selected-constructive"
	| "constructive-fallback-best-first";

export interface EditorPlannerStrategyDiagnostics {
	readonly attempts: ReadonlyArray<EditorPlannerStrategyAttemptDiagnostic>;
	readonly mode: EditorPlannerStrategyMode;
	readonly selectedAttemptIndex: number;
	readonly selection: AdaptivePlannerStrategySelection;
}

export type EditorPlannerStrategyResult = PlannerStrategyResult<
	"editor",
	EditorPlannerStrategyDiagnostics
>;

/** Production editor orchestration over compact constructive search and bounded best-first search. */
export interface EditorPlannerStrategy
	extends PlannerStrategy<
		"editor",
		EditorPlannerStrategyDiagnostics,
		PlannerStrategyEnvironment
	> {
	//
}

export interface EditorPlannerStrategyProps {
	readonly bestFirstBudget?: Partial<PlannerSearchBudget>;
	readonly constructiveBudget?: Partial<PlannerGoalSearchBudget>;
	readonly policy?: Partial<EditorPlannerStrategyPolicy>;
}
