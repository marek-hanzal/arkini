import type {
	PlannerSearchBudget,
	PlannerSearchOutputCertainty,
	PlannerSearchRoutePlanOutcome,
} from "~/editor/planner/PlannerSearch";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

export type PlannerCoverageAuditOutcome = "completed" | "inconclusive" | "no-finite-path";

export interface PlannerCoverageAuditFrequency {
	readonly count: number;
	readonly key: string;
}

export interface PlannerCoverageAuditLatencySummary {
	readonly maximumMs: number;
	readonly meanMs: number;
	readonly medianMs: number;
	readonly p95Ms: number;
	readonly totalMs: number;
}

export interface PlannerCoverageAuditSearchSummary {
	readonly expandedStates: number;
	readonly routePlans: number;
	readonly visitedStates: number;
}

export interface PlannerCoverageAuditOutcomeCounts {
	readonly completed: number;
	readonly inconclusive: number;
	readonly noFinitePath: number;
}

export interface PlannerCoverageAuditItemTypeSummary {
	readonly itemType: ItemSchema.Type["type"];
	readonly outcomes: PlannerCoverageAuditOutcomeCounts;
	readonly totalItems: number;
}

export interface PlannerCoverageAuditRankedItem {
	readonly expandedStates: number;
	readonly itemId: IdSchema.Type;
	readonly outcome: PlannerCoverageAuditOutcome;
	readonly routePlans: number;
	readonly searchDurationMs: number;
	readonly title: string;
	readonly visitedStates: number;
	readonly winningRoutePlanIndex?: number;
}

interface PlannerCoverageAuditItemBase {
	readonly blockedActionIds: ReadonlyArray<string>;
	readonly expandedStates: number;
	readonly itemId: IdSchema.Type;
	readonly itemType: ItemSchema.Type["type"];
	readonly routePlanOutcomes: ReadonlyArray<PlannerSearchRoutePlanOutcome>;
	readonly routePlans: number;
	readonly searchDurationMs: number;
	readonly title: string;
	readonly unsupportedActionIds: ReadonlyArray<string>;
	readonly visitedStates: number;
	readonly winningRoutePlanIndex?: number;
}

export type PlannerCoverageAuditItem =
	| (PlannerCoverageAuditItemBase & {
			readonly authoredElapsedMs: number;
			readonly expectedActionRuns: number;
			readonly expectedElapsedMs: number;
			readonly outcome: "completed";
			readonly outputCertainty: PlannerSearchOutputCertainty;
			readonly selectedWitnessProbability: number;
			readonly traceLength: number;
	  })
	| (PlannerCoverageAuditItemBase & {
			readonly bestAvailableQuantity: number;
			readonly budgetLimit?: string;
			readonly frontierSize: number;
			readonly outcome: "inconclusive";
			readonly reason:
				| "action-unsupported"
				| "non-quiescent-runtime"
				| "search-budget"
				| "search-exhausted"
				| "session-budget"
				| "unsupported-routes";
			readonly traceLength: number;
	  })
	| (PlannerCoverageAuditItemBase & {
			readonly blockedRouteCount: number;
			readonly cycleComponentIds: ReadonlyArray<string>;
			readonly outcome: "no-finite-path";
			readonly proofType: "no-finite-path" | "target-missing";
			readonly sourceLessItemIds: ReadonlyArray<IdSchema.Type>;
	  });

export interface PlannerCoverageAuditSummary {
	readonly budgetLimits: ReadonlyArray<PlannerCoverageAuditFrequency>;
	readonly completedCertainties: ReadonlyArray<PlannerCoverageAuditFrequency>;
	readonly inconclusiveReasons: ReadonlyArray<PlannerCoverageAuditFrequency>;
	readonly itemTypes: ReadonlyArray<PlannerCoverageAuditItemTypeSummary>;
	readonly largestSearches: ReadonlyArray<PlannerCoverageAuditRankedItem>;
	readonly latency: PlannerCoverageAuditLatencySummary;
	readonly outcomes: PlannerCoverageAuditOutcomeCounts;
	readonly routePlanOutcomes: ReadonlyArray<PlannerCoverageAuditFrequency>;
	readonly search: PlannerCoverageAuditSearchSummary;
	readonly slowestItems: ReadonlyArray<PlannerCoverageAuditRankedItem>;
	readonly topBlockedActions: ReadonlyArray<PlannerCoverageAuditFrequency>;
	readonly topUnsupportedActions: ReadonlyArray<PlannerCoverageAuditFrequency>;
	readonly totalItems: number;
}

export interface PlannerCoverageAuditReport {
	readonly budget: PlannerSearchBudget;
	readonly items: ReadonlyArray<PlannerCoverageAuditItem>;
	readonly quantity: number;
	readonly summary: PlannerCoverageAuditSummary;
	readonly version: 1;
}
