import { Effect } from "effect";

import type { PlannerKernel } from "~/editor/planner/PlannerKernel";
import { createPlannerAcquisitionGraphFx } from "~/editor/planner/createPlannerAcquisitionGraphFx";
import { createPlannerInitialRuntimeFx } from "~/editor/planner/createPlannerInitialRuntimeFx";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerGoalViabilityFx } from "~/editor/planner/readPlannerGoalViabilityFx";
import { readPlannerStructuralReachabilityFx } from "~/editor/planner/readPlannerStructuralReachabilityFx";
import { runPlannerSearchCandidateFx } from "~/editor/planner/runPlannerSearchCandidateFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Creates the shared immutable planner kernel over one authored config snapshot. */
export const createPlannerKernelFx = Effect.fn("createPlannerKernelFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const graph = yield* createPlannerAcquisitionGraphFx(config);
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
				readGoalViabilityFx: ({ goal, runtime }) =>
					readPlannerGoalViabilityFx({
						goal,
						graph,
						runtime,
					}),
				readStructuralReachabilityFx: (itemId) =>
					readPlannerStructuralReachabilityFx({
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
