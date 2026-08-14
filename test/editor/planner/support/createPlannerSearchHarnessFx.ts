import { Effect } from "effect";

import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
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
			const graph = createPlannerAcquisitionGraph(config);
			const initialRuntime = yield* createPlannerInitialRuntimeFx(config);
			return {
				constructiveSearchFx: (
					itemId: IdSchema.Type,
					quantity = 1,
					budget?: Partial<PlannerGoalSearchBudget>,
				) =>
					searchPlannerGoalFx({
						budget,
						graph,
						itemId,
						quantity,
						runtime: initialRuntime,
					}).pipe(Effect.provideService(GameConfigFx, config)),
				graph,
				initialRuntime,
				searchFx: (
					itemId: IdSchema.Type,
					quantity = 1,
					budget?: Partial<PlannerSearchBudget>,
				) =>
					searchPlannerRuntimeFx({
						budget,
						graph,
						itemId,
						quantity,
						runtime: initialRuntime,
					}).pipe(Effect.provideService(GameConfigFx, config)),
			};
		}),
);
