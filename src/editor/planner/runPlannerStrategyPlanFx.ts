import { Effect } from "effect";

import type { PlannerEstimateRequest, PlannerStrategies } from "~/editor/planner/Planner";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	AnyPlannerStrategyResult,
	PlannerResult,
	PlannerStrategyAttempt,
} from "~/editor/planner/PlannerResult";
import {
	DefaultPlannerStrategyPlan,
	type PlannerStrategyPlanEntry,
} from "~/editor/planner/PlannerStrategyPlan";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace runPlannerStrategyPlanFx {
	export interface Props {
		readonly graph: PlannerAcquisitionGraph;
		readonly initialRuntime: RuntimeSchema.Type;
		readonly request: PlannerEstimateRequest;
		readonly strategies: PlannerStrategies;
	}
}

const readStrategyResultFx = ({
	entry,
	request,
	strategies,
}: {
	readonly entry: PlannerStrategyPlanEntry;
	readonly request: Parameters<PlannerStrategies["bestFirst"]["runFx"]>[0];
	readonly strategies: PlannerStrategies;
}): Effect.Effect<AnyPlannerStrategyResult> => {
	switch (entry.strategyId) {
		case "best-first":
			return strategies.bestFirst.runFx(request, entry.budget);
		case "constructive":
			return strategies.constructive.runFx(request, entry.budget);
	}
};

const assertPlannerStrategyPlan = (
	strategyPlan: ReadonlyArray<PlannerStrategyPlanEntry>,
): Effect.Effect<void> => {
	if (strategyPlan.length === 0)
		return Effect.die(
			new RangeError("Planner strategy plan must contain at least one strategy."),
		);
	const strategyIds = strategyPlan.map(({ strategyId }) => strategyId);
	if (new Set(strategyIds).size !== strategyIds.length)
		return Effect.die(
			new RangeError(
				"Planner strategy plan may not invoke the same strategy more than once.",
			),
		);
	return Effect.void;
};

/** Runs deterministic strategy fallback and retains every attempted result for diagnostics. */
export const runPlannerStrategyPlanFx = Effect.fn("runPlannerStrategyPlanFx")(function* ({
	graph,
	initialRuntime,
	request,
	strategies,
}: runPlannerStrategyPlanFx.Props) {
	const quantity = request.quantity ?? 1;
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);
	const strategyPlan = request.strategyPlan ?? DefaultPlannerStrategyPlan;
	yield* assertPlannerStrategyPlan(strategyPlan);
	const strategyRequest = {
		goal: {
			itemId: request.itemId,
			quantity,
		},
		runtime: request.runtime ?? initialRuntime,
	};
	const attempts: PlannerStrategyAttempt[] = [];

	for (const [offset, entry] of strategyPlan.entries()) {
		const result = yield* readStrategyResultFx({
			entry,
			request: strategyRequest,
			strategies,
		});
		const attempt: PlannerStrategyAttempt = {
			index: offset + 1,
			result,
		};
		attempts.push(attempt);
		switch (result.type) {
			case "completed": {
				const economics = yield* readPlannerExpectedEconomicsFx({
					graph,
					initialRuntime: strategyRequest.runtime,
					itemId: request.itemId,
					quantity,
					trace: result.execution.trace,
				});
				return {
					attempts,
					availableQuantity: result.availableQuantity,
					economics,
					execution: result.execution,
					itemId: request.itemId,
					quantity,
					type: "completed",
					winningAttemptIndex: attempt.index,
					winningStrategyId: result.strategyId,
				} satisfies PlannerResult;
			}
			case "no-finite-path":
				return {
					attempts,
					itemId: request.itemId,
					proof: result.proof,
					provingAttemptIndex: attempt.index,
					provingStrategyId: result.strategyId,
					quantity,
					type: "no-finite-path",
				} satisfies PlannerResult;
			case "inconclusive":
				break;
		}
	}

	return {
		attempts,
		bestAvailableQuantity: Math.max(
			0,
			...attempts.map(({ result }) =>
				result.type === "inconclusive" ? result.bestAvailableQuantity : 0,
			),
		),
		itemId: request.itemId,
		quantity,
		type: "inconclusive",
	} satisfies PlannerResult;
});
