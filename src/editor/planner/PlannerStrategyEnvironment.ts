import type { PlannerCurrentStrategyFx } from "~/editor/planner/PlannerCurrentStrategyFx";
import type { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import type { PlannerSessionFx } from "~/editor/planner/PlannerSessionFx";
import type { PlannerStrategy } from "~/editor/planner/PlannerStrategy";

export type PlannerStrategyEnvironment =
	| PlannerCurrentStrategyFx
	| PlannerKernelFx
	| PlannerSessionFx;

export type AnyPlannerStrategy = PlannerStrategy<string, unknown, PlannerStrategyEnvironment>;
