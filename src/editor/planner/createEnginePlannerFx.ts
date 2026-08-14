import { Effect } from "effect";

import type { EnginePlanner } from "~/editor/planner/EnginePlanner";
import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Creates the planner orchestrator plus compatibility entry points for existing callers. */
export const createEnginePlannerFx = Effect.fn("createEnginePlannerFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const planner = yield* createPlannerFx(config);
			return {
				...planner,
				constructiveSearchFx: Effect.fn("EnginePlanner.constructiveSearchFx")(
					(
						itemId: IdSchema.Type,
						quantity?: number,
						budget?: Partial<PlannerGoalSearchBudget>,
					) =>
						planner.strategies.constructive.searchFx(
							{
								goal: {
									itemId,
									quantity: quantity ?? 1,
								},
								runtime: planner.initialRuntime,
							},
							budget,
						),
				),
				searchFx: Effect.fn("EnginePlanner.searchFx")(
					(
						itemId: IdSchema.Type,
						quantity?: number,
						budget?: Partial<PlannerSearchBudget>,
					) =>
						planner.strategies.bestFirst.searchFx(
							{
								goal: {
									itemId,
									quantity: quantity ?? 1,
								},
								runtime: planner.initialRuntime,
							},
							budget,
						),
				),
			} satisfies EnginePlanner;
		}),
);
