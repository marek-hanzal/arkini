import type { PlannerAction } from "~/editor/planner/PlannerAction";

/** Stable collision-free identity for one authored planner action. */
export const readPlannerActionId = (action: PlannerAction) => {
	switch (action.kind) {
		case "line":
			return JSON.stringify([
				action.kind,
				action.ownerItemId,
				action.lineId,
			]);
		case "merge":
			return JSON.stringify([
				action.kind,
				action.sourceItemId,
				action.targetItemId,
				action.mergeIndex,
			]);
		case "temporary-expiry":
			return JSON.stringify([
				action.kind,
				action.itemId,
			]);
	}
};
