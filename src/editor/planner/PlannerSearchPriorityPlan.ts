import type {
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export interface PlannerSearchPriorityPlan {
	readonly chargeCapacityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly maximumSingleActionOutputByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly preferredRequirementByClauseId: ReadonlyMap<string, PlannerAcquisitionRequirement>;
	readonly renewalRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
	readonly witnessRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
}
