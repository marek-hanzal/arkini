import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerProducerExpansionBudget } from "~/editor/planner/PlannerProducerExpansion";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import type {
	PlannerStrategy,
	PlannerStrategyMetrics,
	PlannerStrategyResult,
} from "~/editor/planner/PlannerStrategy";
import type { PlannerStrategyEnvironment } from "~/editor/planner/PlannerStrategyEnvironment";

export interface EditorPlannerStrategySelection {
	readonly reason: string;
	readonly strategyId: "best-first" | "constructive";
}

export interface EditorPlannerStrategyPolicy {
	readonly maximumBestFirstDepth: number;
	readonly maximumProducerExpansionDepth: number;
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
	| "constructive-fallback-best-first"
	| "selected-best-first"
	| "selected-constructive"
	| "selected-producer-expansion"
	| "producer-expansion-fallback-best-first"
	| "producer-expansion-fallback-constructive"
	| "producer-expansion-fallback-constructive-fallback-best-first";

export interface EditorPlannerStrategyDiagnostics {
	readonly attempts: ReadonlyArray<EditorPlannerStrategyAttemptDiagnostic>;
	readonly mode: EditorPlannerStrategyMode;
	readonly selectedAttemptIndex: number;
	readonly selection: EditorPlannerStrategySelection | null;
}

export type EditorPlannerStrategyResult = PlannerStrategyResult<
	"editor",
	EditorPlannerStrategyDiagnostics
>;

/** Production editor orchestration over producer expansion with constructive and best-first fallback. */
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
	readonly producerExpansionBudget?: Partial<PlannerProducerExpansionBudget>;
}
