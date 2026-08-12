import type { IdSchema } from "~/engine/common/schema/IdSchema";

export interface PlannerStructuralBlockedRoute {
	readonly missingAllOfItemIds: ReadonlyArray<IdSchema.Type>;
	readonly missingAnyOfItemIds: ReadonlyArray<ReadonlyArray<IdSchema.Type>>;
	readonly outputItemId: IdSchema.Type;
	readonly routeId: string;
}

export type PlannerStructuralReachability =
	| {
			readonly itemId: IdSchema.Type;
			readonly type: "target-missing";
	  }
	| {
			readonly depth: number;
			readonly itemId: IdSchema.Type;
			readonly type: "reachable";
			readonly witnessItemIds: ReadonlyArray<IdSchema.Type>;
			readonly witnessRouteIds: ReadonlyArray<string>;
	  }
	| {
			readonly blockedRoutes: ReadonlyArray<PlannerStructuralBlockedRoute>;
			readonly cycleComponentIds: ReadonlyArray<string>;
			readonly itemId: IdSchema.Type;
			readonly sourceLessItemIds: ReadonlyArray<IdSchema.Type>;
			readonly type: "no-finite-path";
			readonly unreachableItemIds: ReadonlyArray<IdSchema.Type>;
	  };
