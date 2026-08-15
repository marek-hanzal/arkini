import { Effect } from "effect";

import { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createPlannerAcquisitionGraphFx } from "~/editor/planner/createPlannerAcquisitionGraphFx";
import { createPlannerBudgetFx } from "~/editor/planner/createPlannerBudgetFx";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { searchPlannerGoalFx } from "~/editor/planner/searchPlannerGoalFx";
import { searchPlannerRuntimeFx } from "~/editor/planner/searchPlannerRuntimeFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Test-only access to the leaf search algorithms after deleting the historical public facade. */
export const createPlannerSearchHarnessFx = Effect.fn("createPlannerSearchHarnessFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const graph = yield* createPlannerAcquisitionGraphFx(config);
			const initialRuntime = yield* createPlannerInitialRuntimeFx(config);
			const provideHarnessServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
				Effect.gen(function* () {
					const plannerBudget = yield* createPlannerBudgetFx();
					return yield* effect.pipe(
						Effect.provideService(GameConfigFx, config),
						Effect.provideService(PlannerBudgetFx, plannerBudget),
					);
				});
			return {
				runConstructiveFx: (
					itemId: IdSchema.Type,
					quantity = 1,
					budget?: Partial<PlannerGoalSearchBudget>,
				) =>
					provideHarnessServices(
						searchPlannerGoalFx({
							budget,
							graph,
							itemId,
							quantity,
							runtime: initialRuntime,
						}),
					),
				graph,
				initialRuntime,
				runBestFirstFx: (
					itemId: IdSchema.Type,
					quantity = 1,
					budget?: Partial<PlannerSearchBudget>,
				) =>
					provideHarnessServices(
						searchPlannerRuntimeFx({
							budget,
							graph,
							itemId,
							quantity,
							runtime: initialRuntime,
						}),
					),
			};
		}),
);
