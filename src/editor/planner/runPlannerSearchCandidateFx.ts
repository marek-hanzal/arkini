import { Effect, Option } from "effect";

import { PlannerBudgetCounter } from "~/editor/planner/PlannerBudget";
import { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import { readPlannerActionChargeFlowFx } from "~/editor/planner/readPlannerActionChargeFlowFx";
import { readPlannerActionItemFlowFx } from "~/editor/planner/readPlannerActionItemFlowFx";
import { runPlannerActionFx } from "~/editor/planner/runPlannerActionFx";
import type { PlannerActionResult } from "~/editor/planner/PlannerActionResult";

export type PlannerSearchCandidateResult =
	| {
			readonly candidate: PlannerSearchAction;
			readonly result: Extract<
				PlannerActionResult,
				{
					readonly type: "blocked";
				}
			>;
			readonly type: "blocked";
	  }
	| {
			readonly candidate: PlannerSearchAction;
			readonly result: Extract<
				PlannerActionResult,
				{
					readonly type: "unsupported";
				}
			>;
			readonly type: "unsupported";
	  }
	| {
			readonly candidate: PlannerSearchAction;
			readonly result: Extract<
				PlannerActionResult,
				{
					readonly type: "completed";
				}
			>;
			readonly state: PlannerSearchExecutionState;
			readonly type: "advanced";
	  };

/** Advances one immutable search branch through the canonical planner action boundary. */
export const runPlannerSearchCandidateFx = Effect.fn("runPlannerSearchCandidateFx")(function* ({
	candidate,
	state,
}: {
	readonly candidate: PlannerSearchAction;
	readonly state: PlannerSearchExecutionState;
}) {
	const budget = yield* Effect.serviceOption(PlannerBudgetFx);
	if (Option.isSome(budget))
		yield* budget.value.consumeFx(PlannerBudgetCounter.engineTransitions);
	const result = yield* runPlannerActionFx({
		action: candidate.action,
		outputWitness: candidate.outputWitness,
		runtime: state.runtime,
	});
	if (result.type === "blocked")
		return {
			candidate,
			result,
			type: "blocked" as const,
		};
	if (result.type === "unsupported")
		return {
			candidate,
			result,
			type: "unsupported" as const,
		};

	const outputWitnessResolved =
		candidate.outputMode === "existential" && result.outputWitnessResolved;
	const itemFlow = yield* readPlannerActionItemFlowFx({
		after: result.runtime,
		before: state.runtime,
	});
	const spentChargeQuantities = yield* readPlannerActionChargeFlowFx({
		before: state.runtime,
		events: result.events,
	});
	return {
		candidate,
		result,
		state: {
			elapsedMs: state.elapsedMs + result.elapsedMs,
			outputCertainty:
				state.outputCertainty === "possible" || outputWitnessResolved
					? "possible"
					: "deterministic",
			runtime: result.runtime,
			selectedWitnessProbability:
				state.selectedWitnessProbability *
				(outputWitnessResolved
					? candidate.outputWitness.statistics.maximumQuantityProbability
					: 1),
			trace: [
				...state.trace,
				{
					action: candidate.action,
					actionId: candidate.actionId,
					actor: result.actor,
					consumedItemQuantities: itemFlow.consumedItemQuantities,
					elapsedMs: result.elapsedMs,
					events: result.events,
					outputResolution: outputWitnessResolved
						? {
								outputItemId: candidate.outputWitness.outputItemId,
								routeId: candidate.outputWitness.routeId,
								statistics: candidate.outputWitness.statistics,
								type: "existential" as const,
								witnessId: candidate.outputWitness.witnessId,
							}
						: {
								type: "canonical" as const,
							},
					outputItemIds: candidate.outputItemIds,
					producedItemQuantities: itemFlow.producedItemQuantities,
					routeIds: candidate.routeIds,
					spentChargeQuantities,
				},
			],
		} satisfies PlannerSearchExecutionState,
		type: "advanced" as const,
	};
});
