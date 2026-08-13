import { Data } from "effect";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import type {
	PlannerCoverageAuditItem,
	PlannerCoverageAuditOutcome,
	PlannerCoverageAuditOutcomeCounts,
	PlannerCoverageAuditSummary,
	PlannerCoverageAuditSearchSummary,
} from "~/editor/planner/PlannerCoverageAudit";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

export interface PlannerCoverageTierDefinition {
	readonly budget: Partial<PlannerSearchBudget>;
	readonly id: string;
}

export interface PlannerCoverageTier {
	readonly budget: PlannerSearchBudget;
	readonly id: string;
}

export interface PlannerCoverageTierAuditAttempt {
	readonly result: PlannerCoverageAuditItem;
	readonly tierId: string;
	/** One-based tier index in execution order. */
	readonly tierIndex: number;
}

export interface PlannerCoverageTierAuditProgress {
	readonly index: number;
	readonly itemId: IdSchema.Type;
	readonly outcome: PlannerCoverageAuditOutcome;
	readonly searchDurationMs: number;
	readonly tierCount: number;
	readonly tierId: string;
	/** One-based tier index in execution order. */
	readonly tierIndex: number;
	readonly title: string;
	readonly total: number;
}

export interface PlannerCoverageTierAuditItem {
	readonly attempts: ReadonlyArray<PlannerCoverageTierAuditAttempt>;
	readonly finalOutcome: PlannerCoverageAuditOutcome;
	readonly itemId: IdSchema.Type;
	readonly itemType: ItemSchema.Type["type"];
	readonly resolvedTierId?: string;
	/** First one-based tier index that produced a terminal result. */
	readonly resolvedTierIndex?: number;
	readonly title: string;
}

export interface PlannerCoverageTierAuditTier {
	readonly attemptSummary: PlannerCoverageAuditSummary;
	readonly attemptedItems: number;
	readonly budget: PlannerSearchBudget;
	readonly carriedCompleted: number;
	readonly carriedNoFinitePath: number;
	readonly cumulativeOutcomes: PlannerCoverageAuditOutcomeCounts;
	readonly id: string;
	/** One-based tier index in execution order. */
	readonly index: number;
	readonly marginalResolutionRate: number;
	readonly newlyCompleted: number;
	readonly newlyNoFinitePath: number;
	readonly remainingInconclusive: number;
	readonly resolutionRate: number;
}

export interface PlannerCoverageTierAuditResolutionFrequency {
	readonly count: number;
	readonly tierId: string;
	readonly tierIndex: number;
}

export interface PlannerCoverageTierAuditSummary {
	readonly finalOutcomes: PlannerCoverageAuditOutcomeCounts;
	readonly resolutionByTier: ReadonlyArray<PlannerCoverageTierAuditResolutionFrequency>;
	readonly saturatedTierId?: string;
	readonly saturatedTierIndex?: number;
	readonly search: PlannerCoverageAuditSearchSummary;
	readonly tierCount: number;
	readonly totalItems: number;
	readonly totalSearchAttempts: number;
	readonly totalSearchDurationMs: number;
	readonly unresolvedItemIds: ReadonlyArray<IdSchema.Type>;
}

export interface PlannerCoverageTierAuditReport {
	readonly items: ReadonlyArray<PlannerCoverageTierAuditItem>;
	readonly quantity: number;
	readonly summary: PlannerCoverageTierAuditSummary;
	readonly tiers: ReadonlyArray<PlannerCoverageTierAuditTier>;
	readonly version: 1;
}

export class PlannerCoverageTierAuditInputError extends Data.TaggedError(
	"PlannerCoverageTierAuditInputError",
)<{
	readonly message: string;
}> {}
