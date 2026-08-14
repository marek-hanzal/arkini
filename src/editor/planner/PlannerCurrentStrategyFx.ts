import { Context } from "effect";

export interface PlannerCurrentStrategyFxService {
	readonly id: string;
	readonly path: ReadonlyArray<string>;
}

/** Branch-local strategy identity used by nested delegation and diagnostics. */
export const PlannerCurrentStrategyFx = Context.Reference<PlannerCurrentStrategyFxService>(
	"PlannerCurrentStrategyFx",
	{
		defaultValue: () => ({
			id: "planner",
			path: [],
		}),
	},
);

export type PlannerCurrentStrategyFx = typeof PlannerCurrentStrategyFx;
