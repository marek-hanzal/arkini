import { Effect } from "effect";

import type {
	AdaptivePlannerStrategy,
	AdaptivePlannerStrategyDiagnostics,
	AdaptivePlannerStrategyProps,
	AdaptivePlannerStrategyResult,
} from "~/editor/planner/AdaptivePlannerStrategy";
import { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import { PlannerCurrentStrategyFx } from "~/editor/planner/PlannerCurrentStrategyFx";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import { PlannerSessionFx } from "~/editor/planner/PlannerSessionFx";
import { PlannerStrategyId, type AnyPlannerStrategyResult } from "~/editor/planner/PlannerStrategy";

const projectChildResult = (
	result: AnyPlannerStrategyResult,
	diagnostics: AdaptivePlannerStrategyDiagnostics,
): AdaptivePlannerStrategyResult => {
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics,
				execution: result.execution,
				metrics: result.metrics,
				strategyId: PlannerStrategyId.adaptive,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics,
				metrics: result.metrics,
				proof: result.proof,
				strategyId: PlannerStrategyId.adaptive,
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
				diagnostics,
				metrics: result.metrics,
				reason: result.reason,
				strategyId: PlannerStrategyId.adaptive,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Composite root strategy that deterministically routes each problem to one child strategy. */
export const createAdaptivePlannerStrategy = ({
	selectFx,
	strategies,
}: AdaptivePlannerStrategyProps): AdaptivePlannerStrategy => {
	const strategyById = new Map(
		strategies.map((strategy) => [
			strategy.id,
			strategy,
		]),
	);
	if (strategyById.size !== strategies.length)
		throw new RangeError("Adaptive planner child strategy IDs must be unique.");
	if (strategyById.has(PlannerStrategyId.adaptive))
		throw new RangeError("Adaptive planner may not register itself as a child strategy.");
	if (strategyById.size === 0)
		throw new RangeError("Adaptive planner requires at least one child strategy.");
	const childStrategyIds = [
		...strategyById.keys(),
	].sort((left, right) => left.localeCompare(right));
	return {
		childStrategyIds,
		id: PlannerStrategyId.adaptive,
		solveFx: Effect.fn("AdaptivePlannerStrategy.solveFx")((problem) =>
			Effect.gen(function* () {
				const budget = yield* PlannerBudgetFx;
				const currentStrategy = yield* PlannerCurrentStrategyFx;
				const kernel = yield* PlannerKernelFx;
				const session = yield* PlannerSessionFx;
				const selection = yield* selectFx({
					budget: {
						limits: budget.limits,
						snapshot: yield* budget.read,
					},
					currentStrategy,
					goalViability: kernel.readGoalViability({
						goal: problem.activeGoal,
						runtime: problem.runtime,
					}),
					graph: kernel.graph,
					problem,
				});
				const strategy = strategyById.get(selection.strategyId);
				if (strategy === undefined)
					return yield* Effect.die(
						new RangeError(
							`Adaptive planner selected unregistered strategy ${selection.strategyId}.`,
						),
					);
				const result = yield* session.runStrategyFx({
					problem,
					reason: selection.reason,
					strategy,
				});
				return projectChildResult(result, {
					child: {
						diagnostics: result.diagnostics,
						strategyId: result.strategyId,
					},
					selection,
				});
			}),
		),
	};
};
