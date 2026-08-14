import { Context } from "effect";

import type { PlannerBudgetFxService } from "~/editor/planner/PlannerBudget";

/** Per-estimate global planner budget shared by every delegated strategy. */
export class PlannerBudgetFx extends Context.Service<PlannerBudgetFx, PlannerBudgetFxService>()(
	"PlannerBudgetFx",
) {
	//
}
