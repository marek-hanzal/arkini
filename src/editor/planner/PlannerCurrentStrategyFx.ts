import { Context } from "effect";

export interface PlannerCurrentStrategyFxService {
	readonly depth: number;
	readonly id: string;
	readonly invocationIndex: number;
	readonly parentInvocationIndex?: number;
	readonly path: ReadonlyArray<string>;
	readonly reason: string;
}

/** Identifies one branch-local strategy invocation inside a planner session. */
export class PlannerCurrentStrategyFx extends Context.Service<
	PlannerCurrentStrategyFx,
	PlannerCurrentStrategyFxService
>()("PlannerCurrentStrategyFx") {
	//
}
