import { Effect } from "effect";

import type {
	ProducerExpansionPlannerStrategy,
	ProducerExpansionPlannerStrategyResult,
} from "~/editor/planner/ProducerExpansionPlannerStrategy";
import {
	DefaultPlannerProducerExpansionBudget,
	type PlannerProducerExpansionBudget,
	type PlannerProducerExpansionResult,
} from "~/editor/planner/PlannerProducerExpansion";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { expandPlannerProducerWorldFx } from "~/editor/planner/expandPlannerProducerWorldFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";

const projectProducerExpansionResult = (
	result: PlannerProducerExpansionResult,
): ProducerExpansionPlannerStrategyResult => {
	const metrics = {
		expandedNodes: result.type === "no-finite-path" ? 0 : result.expandedActions,
		frontierSize: result.type === "inconclusive" ? result.diagnostics.maximumCandidateCount : 0,
		traceLength:
			result.type === "completed"
				? result.execution.trace.length
				: result.type === "inconclusive"
					? result.bestExecution.trace.length
					: 0,
		visitedNodes: result.type === "no-finite-path" ? 0 : result.visitedWorlds,
	};
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics: result.diagnostics,
				execution: result.execution,
				metrics,
				strategyId: PlannerStrategyId.producerExpansion,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics: result.diagnostics,
				metrics,
				proof: result.proof,
				strategyId: PlannerStrategyId.producerExpansion,
				type: "no-finite-path",
			};
		case "inconclusive":
			return {
				bestAvailableQuantity: result.bestAvailableQuantity,
				blockedActionIds: result.blockedActionIds,
				...(result.budgetLimit === undefined
					? {}
					: {
							budgetLimit: result.budgetLimit,
						}),
				diagnostics: result.diagnostics,
				metrics,
				reason: result.reason,
				strategyId: PlannerStrategyId.producerExpansion,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Adapts demand-guided producer world expansion to the common strategy contract. */
export const createProducerExpansionPlannerStrategy = ({
	budget: configuredBudget,
}: {
	readonly budget?: Partial<PlannerProducerExpansionBudget>;
} = {}): ProducerExpansionPlannerStrategy => ({
	id: PlannerStrategyId.producerExpansion,
	solveFx: Effect.fn("ProducerExpansionPlannerStrategy.solveFx")((problem) =>
		Effect.gen(function* () {
			const kernel = yield* PlannerKernelFx;
			return yield* expandPlannerProducerWorldFx({
				budget: {
					...DefaultPlannerProducerExpansionBudget,
					...configuredBudget,
				},
				goal: problem.activeGoal,
				graph: kernel.graph,
				runtime: problem.runtime,
			}).pipe(
				Effect.provideService(GameConfigFx, kernel.config),
				Effect.map(projectProducerExpansionResult),
			);
		}),
	),
});
