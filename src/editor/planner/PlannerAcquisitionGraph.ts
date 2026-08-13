import type {
	PlannerLineAction,
	PlannerMergeAction,
	PlannerTemporaryExpiryAction,
} from "~/editor/planner/PlannerAction";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { OutputSelectionWitness } from "~/engine/output/OutputSelectionWitness";

export type PlannerAcquisitionRequirementUsage = "charge" | "consume" | "presence" | "reserve";

export type PlannerAcquisitionRequirementSource =
	| "charged-item"
	| "deposit-input"
	| "line-condition"
	| "material-input"
	| "merge-source"
	| "merge-target"
	| "output-condition"
	| "owner"
	| "temporary-item";

/** One positive authored fact referenced by a structural acquisition route. */
export interface PlannerAcquisitionRequirement {
	readonly chargeCost?: number;
	readonly inputIndex?: number;
	readonly itemId: IdSchema.Type;
	readonly minimumQuantity: number;
	readonly ruleIndex?: number;
	readonly source: PlannerAcquisitionRequirementSource;
	readonly usage: PlannerAcquisitionRequirementUsage;
	readonly whenIndex?: number;
}

/**
 * Monotone route requirements.
 *
 * Every `allOf` fact is required. Every inner `anyOf` clause requires at least one reachable
 * alternative. Exact quantities, identities and ordering remain engine-backed search concerns.
 */
export interface PlannerAcquisitionRequirements {
	readonly allOf: ReadonlyArray<PlannerAcquisitionRequirement>;
	readonly anyOf: ReadonlyArray<ReadonlyArray<PlannerAcquisitionRequirement>>;
}

export type PlannerAcquisitionSelection = "chance" | "guaranteed" | "replacement" | "weighted";

/** One exact probability mass in an authored non-negative integer output distribution. */
export interface PlannerAcquisitionQuantityProbability {
	readonly probability: number;
	readonly quantity: number;
}

export type PlannerAcquisitionQuantityDistribution =
	ReadonlyArray<PlannerAcquisitionQuantityProbability>;

export interface PlannerAcquisitionOutputStatistics {
	/** Unconditional mean contribution of this exact authored output occurrence per action. */
	readonly expectedQuantity: number;
	readonly maximumQuantity: number;
	/** Probability that this exact occurrence contributes its maximum quantity. */
	readonly maximumQuantityProbability: number;
	/** Probability that this exact authored occurrence emits at least one item. */
	readonly occurrenceProbability: number;
	readonly quantityDistribution: PlannerAcquisitionQuantityDistribution;
	readonly selection: PlannerAcquisitionSelection;
	readonly stochastic: boolean;
}

export interface PlannerAcquisitionOutput extends PlannerAcquisitionOutputStatistics {
	readonly itemId: IdSchema.Type;
	readonly witness?: OutputSelectionWitness;
	readonly witnessId: string;
}

interface PlannerAcquisitionRouteBase {
	/** Stable identity including the exact authored output occurrence. */
	readonly id: string;
	readonly output: PlannerAcquisitionOutput;
	readonly requirements: PlannerAcquisitionRequirements;
}

export interface PlannerLineOutputAcquisitionRoute extends PlannerAcquisitionRouteBase {
	readonly action: PlannerLineAction;
	readonly kind: "line-output";
}

export interface PlannerLineChargeDepletionAcquisitionRoute extends PlannerAcquisitionRouteBase {
	readonly action: PlannerLineAction;
	readonly chargedItemId: IdSchema.Type;
	readonly chargeCosts: ReadonlyArray<number>;
	readonly kind: "line-charge-depletion";
	/** Optimistic lower bound only; exact payer identity arithmetic belongs to runtime search. */
	readonly minimumRunsLowerBound: number;
}

export interface PlannerMergeOutputAcquisitionRoute extends PlannerAcquisitionRouteBase {
	readonly action: PlannerMergeAction;
	readonly kind: "merge-output";
	readonly source: "output" | "replacement";
}

export interface PlannerTemporaryExpiryAcquisitionRoute extends PlannerAcquisitionRouteBase {
	readonly action: PlannerTemporaryExpiryAction;
	readonly kind: "temporary-expiry";
}

/** One possible authored witness for acquiring one canonical item. */
export type PlannerAcquisitionRoute =
	| PlannerLineChargeDepletionAcquisitionRoute
	| PlannerLineOutputAcquisitionRoute
	| PlannerMergeOutputAcquisitionRoute
	| PlannerTemporaryExpiryAcquisitionRoute;

/** One strongly connected component in the item-level dependency projection. */
export interface PlannerAcquisitionComponent {
	readonly cyclic: boolean;
	readonly id: string;
	readonly itemIds: ReadonlyArray<IdSchema.Type>;
	readonly reachableItemIds: ReadonlyArray<IdSchema.Type>;
	readonly rootItemIds: ReadonlyArray<IdSchema.Type>;
	readonly unreachableItemIds: ReadonlyArray<IdSchema.Type>;
}

/** Static optimistic map used to prune and explain later engine-backed search. */
export interface PlannerAcquisitionGraph {
	/** Full authored charge capacity of one fresh runtime item identity. */
	readonly chargeCapacityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly componentByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionComponent>;
	readonly components: ReadonlyArray<PlannerAcquisitionComponent>;
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly itemIds: ReadonlySet<IdSchema.Type>;
	readonly reachableItemIds: ReadonlySet<IdSchema.Type>;
	readonly reachableRouteIds: ReadonlySet<string>;
	readonly rootItemIds: ReadonlySet<IdSchema.Type>;
	readonly routeDepthById: ReadonlyMap<string, number>;
	readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
	readonly routesByOutputItemId: ReadonlyMap<
		IdSchema.Type,
		ReadonlyArray<PlannerAcquisitionRoute>
	>;
	readonly routesByRequiredItemId: ReadonlyMap<
		IdSchema.Type,
		ReadonlyArray<PlannerAcquisitionRoute>
	>;
	readonly startQuantityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly unreachableItemIds: ReadonlySet<IdSchema.Type>;
	readonly witnessRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
}
