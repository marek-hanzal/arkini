import { Effect } from "effect";

import type { PlannerSearch, PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { searchPlannerRuntimeFx } from "~/editor/planner/searchPlannerRuntimeFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Creates one reusable engine-backed planner over an immutable editor config snapshot. */
export const createEnginePlannerFx = Effect.fn("createEnginePlannerFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const graph = createPlannerAcquisitionGraph(config);
			const initialRuntime = yield* createPlannerInitialRuntimeFx(config);
			return {
				graph,
				initialRuntime,
				searchFx: Effect.fn("EnginePlanner.searchFx")(
					(
						itemId: IdSchema.Type,
						quantity?: number,
						budget?: Partial<PlannerSearchBudget>,
					) =>
						searchPlannerRuntimeFx({
							budget,
							graph,
							itemId,
							quantity: quantity ?? 1,
							runtime: initialRuntime,
						}).pipe(Effect.provideService(GameConfigFx, config)),
				),
			} satisfies PlannerSearch;
		}),
);
