import { Effect } from "effect";

import type { PlannerKernel } from "~/editor/planner/PlannerKernel";
import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerGoalViability } from "~/editor/planner/readPlannerGoalViability";
import { readPlannerStructuralReachability } from "~/editor/planner/readPlannerStructuralReachability";
import { runPlannerSearchCandidateFx } from "~/editor/planner/runPlannerSearchCandidateFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Creates the shared immutable planner kernel over one authored config snapshot. */
export const createPlannerKernelFx = Effect.fn("createPlannerKernelFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const graph = createPlannerAcquisitionGraph(config);
			const initialRuntime = yield* createPlannerInitialRuntimeFx(config);
			return {
				config,
				graph,
				initialRuntime,
				readExpectedEconomicsFx: Effect.fn("PlannerKernel.readExpectedEconomicsFx")(
					(request) =>
						readPlannerExpectedEconomicsFx({
							...request,
							graph,
						}),
				),
				readGoalViability: ({ goal, runtime }) =>
					readPlannerGoalViability({
						goal,
						graph,
						runtime,
					}),
				readStructuralReachability: (itemId) =>
					readPlannerStructuralReachability({
						graph,
						itemId,
					}),
				runCandidateFx: Effect.fn("PlannerKernel.runCandidateFx")((request) =>
					runPlannerSearchCandidateFx(request).pipe(
						Effect.provideService(GameConfigFx, config),
					),
				),
			} satisfies PlannerKernel;
		}),
);
