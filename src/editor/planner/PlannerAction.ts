import type { IdSchema } from "~/engine/common/schema/IdSchema";

export interface PlannerLineAction {
	readonly kind: "line";
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
}

export interface PlannerMergeAction {
	readonly kind: "merge";
	readonly mergeIndex: number;
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
}

export interface PlannerTemporaryExpiryAction {
	readonly itemId: IdSchema.Type;
	readonly kind: "temporary-expiry";
}

/** One authored transition the planner may ask the canonical engine to execute. */
export type PlannerAction = PlannerLineAction | PlannerMergeAction | PlannerTemporaryExpiryAction;
