import { Effect, Result } from "effect";

import type { PlannerBudgetLimits } from "~/editor/planner/PlannerBudget";
import { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type { PlannerEstimateRequest } from "~/editor/planner/Planner";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import { createRootPlannerProblem } from "~/editor/planner/PlannerProblem";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import { PlannerSessionFx } from "~/editor/planner/PlannerSessionFx";
import type { PlannerStrategy, PlannerStrategyMetrics } from "~/editor/planner/PlannerStrategy";
import type { PlannerStrategyEnvironment } from "~/editor/planner/PlannerStrategyEnvironment";
import { createPlannerBudgetFx } from "~/editor/planner/createPlannerBudgetFx";
import { createPlannerSessionFx } from "~/editor/planner/createPlannerSessionFx";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";

export namespace runPlannerFx {
	export interface Props<StrategyId extends string, Diagnostics> {
		readonly budget?: Partial<PlannerBudgetLimits>;
		readonly request: PlannerEstimateRequest;
		readonly strategy: PlannerStrategy<StrategyId, Diagnostics, PlannerStrategyEnvironment>;
	}
}

const EmptyPlannerStrategyMetrics: PlannerStrategyMetrics = {
	expandedNodes: 0,
	frontierSize: 0,
	traceLength: 0,
	visitedNodes: 0,
};

/** Runs one root strategy inside a fresh Effect-native planning session. */
export const runPlannerFx = Effect.fn("runPlannerFx")(function* <
	StrategyId extends string,
	Diagnostics,
>({ budget: configuredBudget, request, strategy }: runPlannerFx.Props<StrategyId, Diagnostics>) {
	const kernel = yield* PlannerKernelFx;
	const quantity = request.quantity ?? 1;
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);
	const runtime = request.runtime ?? kernel.initialRuntime;
	const goal = {
		itemId: request.itemId,
		quantity,
	};
	const budget = yield* createPlannerBudgetFx({
		...configuredBudget,
		...request.budget,
	});
	const session = yield* createPlannerSessionFx({
		rootStrategy: strategy,
	}).pipe(Effect.provideService(PlannerBudgetFx, budget));
	const outcome = yield* session
		.runStrategyFx({
			problem: createRootPlannerProblem({
				goal,
				runtime,
			}),
			reason: "root-estimate",
			strategy,
		})
		.pipe(
			Effect.provideService(PlannerBudgetFx, budget),
			Effect.provideService(PlannerSessionFx, session),
			Effect.result,
		);
	const sessionDiagnostics = yield* session.readDiagnosticsFx;

	if (Result.isFailure(outcome))
		return {
			bestAvailableQuantity: readPlannerRuntimeQuantity(runtime, request.itemId),
			blockedActionIds: [],
			budgetLimit: outcome.failure.counter,
			itemId: request.itemId,
			quantity,
			reason: "session-budget",
			sessionDiagnostics,
			strategyDiagnostics: null,
			strategyId: strategy.id,
			strategyMetrics: EmptyPlannerStrategyMetrics,
			type: "inconclusive",
			unsupportedActionIds: [],
		} satisfies PlannerResult<StrategyId, Diagnostics>;

	const result = outcome.success;
	if (result.strategyId !== strategy.id)
		return yield* Effect.die(
			new Error(
				`Root strategy ${strategy.id} returned result owned by ${result.strategyId}. Composite strategies must project child results to their own identity.`,
			),
		);
	const common = {
		itemId: request.itemId,
		quantity,
		sessionDiagnostics,
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
			const economics = yield* kernel.readExpectedEconomicsFx({
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
