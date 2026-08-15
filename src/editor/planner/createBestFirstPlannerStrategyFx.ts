import { Effect } from "effect";

import type {
	BestFirstPlannerStrategy,
	BestFirstPlannerStrategyResult,
} from "~/editor/planner/BestFirstPlannerStrategy";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import {
	DefaultPlannerSearchBudget,
	type PlannerSearchBudget,
	type PlannerSearchResult,
} from "~/editor/planner/PlannerSearch";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { readPlannerItemGoalStatusFx } from "~/editor/planner/readPlannerItemGoalStatusFx";
import { searchPlannerRuntimeFx } from "~/editor/planner/searchPlannerRuntimeFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";

const EmptyBestFirstDiagnostics = {
	attemptedRoutePlans: 0,
	routePlans: [],
} as const;

const EmptyBestFirstMetrics = {
	expandedNodes: 0,
	frontierSize: 0,
	traceLength: 0,
	visitedNodes: 0,
} as const;

const projectBestFirstResult = (result: PlannerSearchResult): BestFirstPlannerStrategyResult => {
	const metrics = {
		expandedNodes: result.type === "no-finite-path" ? 0 : result.expandedStates,
		frontierSize: result.type === "inconclusive" ? result.frontierSize : 0,
		traceLength:
			result.type === "completed"
				? result.trace.length
				: result.type === "inconclusive"
					? result.trace.length
					: 0,
		visitedNodes: result.type === "no-finite-path" ? 0 : result.visitedStates,
	};
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics: result.diagnostics,
				execution: {
					elapsedMs: result.elapsedMs,
					outputCertainty: result.outputCertainty,
					runtime: result.runtime,
					selectedWitnessProbability: result.selectedWitnessProbability,
					trace: result.trace,
				},
				metrics,
				strategyId: PlannerStrategyId.bestFirst,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics: result.diagnostics,
				metrics,
				proof: result.proof,
				strategyId: PlannerStrategyId.bestFirst,
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
				strategyId: PlannerStrategyId.bestFirst,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Adapts the established global runtime search to the common strategy contract. */
export const createBestFirstPlannerStrategyFx = Effect.fn("createBestFirstPlannerStrategyFx")(
	({ budget: configuredBudget }: { readonly budget?: Partial<PlannerSearchBudget> } = {}) =>
		Effect.succeed({
			id: PlannerStrategyId.bestFirst,
			solveFx: Effect.fn("BestFirstPlannerStrategy.solveFx")((problem) =>
				Effect.gen(function* () {
					const kernel = yield* PlannerKernelFx;
					const minimumCharges = problem.activeGoal.minimumCharges ?? 0;
					if (minimumCharges > 0) {
						const status = yield* readPlannerItemGoalStatusFx(
							problem.activeGoal,
							problem.runtime,
						);
						if (status.satisfied)
							return {
								availableQuantity: status.availableQuantity,
								diagnostics: EmptyBestFirstDiagnostics,
								execution: {
									elapsedMs: 0,
									outputCertainty: "deterministic" as const,
									runtime: problem.runtime,
									selectedWitnessProbability: 1,
									trace: [],
								},
								metrics: EmptyBestFirstMetrics,
								strategyId: PlannerStrategyId.bestFirst,
								type: "completed" as const,
							};
						return {
							bestAvailableQuantity: status.availableQuantity,
							blockedActionIds: [],
							diagnostics: EmptyBestFirstDiagnostics,
							metrics: EmptyBestFirstMetrics,
							reason: "unsupported-routes" as const,
							strategyId: PlannerStrategyId.bestFirst,
							type: "inconclusive" as const,
							unsupportedActionIds: [],
						};
					}
					return yield* searchPlannerRuntimeFx({
						budget: {
							...DefaultPlannerSearchBudget,
							...configuredBudget,
						},
						graph: kernel.graph,
						itemId: problem.activeGoal.itemId,
						quantity: problem.activeGoal.quantity,
						runtime: problem.runtime,
					}).pipe(
						Effect.provideService(GameConfigFx, kernel.config),
						Effect.map(projectBestFirstResult),
					);
				}),
			),
		} satisfies BestFirstPlannerStrategy),
);
