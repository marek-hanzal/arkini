import type { Effect } from "effect";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionOutputStatistics,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { PlannerActionActor } from "~/editor/planner/PlannerActionResult";
import type { PlannerSearchUnsupportedRoute } from "~/editor/planner/PlannerSearchScope";
import type { PlannerStructuralReachability } from "~/editor/planner/PlannerStructuralReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export type PlannerSearchOutputCertainty = "deterministic" | "possible";

export interface PlannerSearchItemQuantity {
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
}

export interface PlannerSearchBudget {
	readonly maximumExpandedStates: number;
	readonly maximumQueuedStates: number;
	readonly maximumTraceLength: number;
}

export const DefaultPlannerSearchBudget: PlannerSearchBudget = {
	maximumExpandedStates: 2_000,
	maximumQueuedStates: 512,
	maximumTraceLength: 48,
};

export interface PlannerSearchTraceEntry {
	readonly action: PlannerAction;
	readonly actionId: string;
	readonly actor: PlannerActionActor;
	readonly consumedItemQuantities: ReadonlyArray<PlannerSearchItemQuantity>;
	readonly elapsedMs: number;
	readonly events: ReadonlyArray<GameEventSchema.Type>;
	readonly outputResolution:
		| {
				readonly type: "canonical";
		  }
		| {
				readonly outputItemId: IdSchema.Type;
				readonly routeId: string;
				readonly statistics: PlannerAcquisitionOutputStatistics;
				readonly type: "existential";
				readonly witnessId: string;
		  };
	readonly outputItemIds: ReadonlyArray<IdSchema.Type>;
	readonly producedItemQuantities: ReadonlyArray<PlannerSearchItemQuantity>;
	readonly routeIds: ReadonlyArray<string>;
}

export type PlannerSearchBudgetLimit = keyof PlannerSearchBudget;

export type PlannerSearchResult =
	| {
			readonly availableQuantity: number;
			readonly elapsedMs: number;
			readonly expandedStates: number;
			readonly itemId: IdSchema.Type;
			readonly outputCertainty: PlannerSearchOutputCertainty;
			readonly quantity: number;
			readonly runtime: RuntimeSchema.Type;
			/** Product of concrete maximum-output witness probabilities selected by this trace. */
			readonly selectedWitnessProbability: number;
			readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
			readonly type: "completed";
			readonly visitedStates: number;
	  }
	| {
			readonly itemId: IdSchema.Type;
			readonly proof: Exclude<
				PlannerStructuralReachability,
				{
					readonly type: "reachable";
				}
			>;
			readonly quantity: number;
			readonly type: "no-finite-path";
	  }
	| {
			readonly bestAvailableQuantity: number;
			readonly bestRuntime: RuntimeSchema.Type;
			readonly blockedActionIds: ReadonlyArray<string>;
			readonly budgetLimit?: PlannerSearchBudgetLimit;
			readonly expandedStates: number;
			readonly frontierSize: number;
			readonly itemId: IdSchema.Type;
			readonly quantity: number;
			readonly reason:
				| "action-unsupported"
				| "non-quiescent-runtime"
				| "search-budget"
				| "search-exhausted"
				| "unsupported-routes";
			readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
			readonly type: "inconclusive";
			readonly unsupportedActionIds: ReadonlyArray<string>;
			readonly unsupportedRoutes: ReadonlyArray<PlannerSearchUnsupportedRoute>;
			readonly visitedStates: number;
	  };

/** Reusable engine-backed planner rooted in one immutable authored start runtime. */
export interface PlannerSearch {
	readonly graph: PlannerAcquisitionGraph;
	readonly initialRuntime: RuntimeSchema.Type;
	readonly searchFx: (
		itemId: IdSchema.Type,
		quantity?: number,
		budget?: Partial<PlannerSearchBudget>,
	) => Effect.Effect<PlannerSearchResult>;
}
