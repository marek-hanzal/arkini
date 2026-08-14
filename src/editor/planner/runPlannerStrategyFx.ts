import { Effect } from "effect";

import type { PlannerEstimateRequest } from "~/editor/planner/Planner";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import { createRootPlannerProblem } from "~/editor/planner/PlannerProblem";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type { PlannerStrategy } from "~/editor/planner/PlannerStrategy";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace runPlannerStrategyFx {
	export interface Props<StrategyId extends string, Budget, Diagnostics> {
		readonly graph: PlannerAcquisitionGraph;
		readonly initialRuntime: RuntimeSchema.Type;
		readonly request: PlannerEstimateRequest<Budget>;
		readonly strategy: PlannerStrategy<StrategyId, Budget, Diagnostics>;
	}
}

/** Runs one configured root strategy and projects its witness into the public estimate result. */
export const runPlannerStrategyFx = Effect.fn("runPlannerStrategyFx")(function* <
	StrategyId extends string,
	Budget,
	Diagnostics,
>({
	graph,
	initialRuntime,
	request,
	strategy,
}: runPlannerStrategyFx.Props<StrategyId, Budget, Diagnostics>) {
	const quantity = request.quantity ?? 1;
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);
	const runtime = request.runtime ?? initialRuntime;
	const goal = {
		itemId: request.itemId,
		quantity,
	};
	const result = yield* strategy.runFx(
		createRootPlannerProblem({
			goal,
			runtime,
		}),
		request.budget,
	);
	const common = {
		itemId: request.itemId,
		quantity,
		strategyDiagnostics: result.diagnostics,
		strategyId: result.strategyId,
		strategyMetrics: result.metrics,
	};

	switch (result.type) {
		case "completed": {
			const availableQuantity = readPlannerRuntimeQuantity(
				result.execution.runtime,
				request.itemId,
			);
			if (availableQuantity < quantity)
				return yield* Effect.die(
					new Error(
						`Planner strategy ${result.strategyId} reported completion with ${availableQuantity}/${quantity} ${request.itemId}.`,
					),
				);
			const economics = yield* readPlannerExpectedEconomicsFx({
				graph,
				initialRuntime: runtime,
				itemId: request.itemId,
				quantity,
				trace: result.execution.trace,
			});
			return {
				...common,
				availableQuantity,
				economics,
				execution: result.execution,
				type: "completed",
			} satisfies PlannerResult<StrategyId, Diagnostics>;
		}
		case "no-finite-path":
			return {
				...common,
				proof: result.proof,
				type: "no-finite-path",
			} satisfies PlannerResult<StrategyId, Diagnostics>;
		case "inconclusive":
			return {
				...common,
				bestAvailableQuantity: result.bestAvailableQuantity,
				blockedActionIds: result.blockedActionIds,
				...(result.budgetLimit === undefined
					? {}
					: {
							budgetLimit: result.budgetLimit,
						}),
				reason: result.reason,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			} satisfies PlannerResult<StrategyId, Diagnostics>;
	}
});
