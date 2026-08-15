import { Effect, Option, Ref } from "effect";

import { PlannerBudgetCounter } from "~/editor/planner/PlannerBudget";
import { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import { PlannerCurrentStrategyFx } from "~/editor/planner/PlannerCurrentStrategyFx";
import { createPlannerSubproblemFx } from "~/editor/planner/createPlannerSubproblemFx";
import type { AnyPlannerStrategy } from "~/editor/planner/PlannerStrategyEnvironment";
import { readPlannerItemGoalStatusFx } from "~/editor/planner/readPlannerItemGoalStatusFx";
import type {
	PlannerSessionDiagnostics,
	PlannerSessionFxService,
	PlannerStrategyInvocationDiagnostic,
} from "~/editor/planner/PlannerSessionFx";

interface PlannerSessionState {
	readonly invocations: ReadonlyArray<PlannerStrategyInvocationDiagnostic>;
	readonly nextInvocationIndex: number;
}

type PlannerSessionClaim = {
	readonly invocation: PlannerStrategyInvocationDiagnostic;
};

export namespace createPlannerSessionFx {
	export interface Props {
		readonly rootStrategy: AnyPlannerStrategy;
	}
}

const updateInvocationOutcome = (
	state: PlannerSessionState,
	index: number,
	outcome: PlannerStrategyInvocationDiagnostic["outcome"],
): PlannerSessionState => ({
	...state,
	invocations: state.invocations.map((invocation) =>
		invocation.index === index
			? {
					...invocation,
					outcome,
				}
			: invocation,
	),
});

/** Creates branch-safe orchestration metadata while all simulated game worlds stay immutable. */
export const createPlannerSessionFx = Effect.fn("createPlannerSessionFx")(function* ({
	rootStrategy,
}: createPlannerSessionFx.Props) {
	const budget = yield* PlannerBudgetFx;
	const stateRef = yield* Ref.make<PlannerSessionState>({
		invocations: [],
		nextInvocationIndex: 1,
	});

	const runStrategyFx: PlannerSessionFxService["runStrategyFx"] = Effect.fn(
		"PlannerSession.runStrategyFx",
	)(function* ({ problem, reason, strategy }) {
		const parentOption = yield* Effect.serviceOption(PlannerCurrentStrategyFx);
		const parent = Option.getOrUndefined(parentOption);
		const depth = (parent?.depth ?? -1) + 1;
		yield* budget.assertDelegationDepthFx(depth);
		yield* budget.consumeFx(PlannerBudgetCounter.strategyInvocations);

		const claim = yield* Ref.modify(
			stateRef,
			(
				state,
			): readonly [
				PlannerSessionClaim,
				PlannerSessionState,
			] => {
				const path = [
					...(parent?.path ?? []),
					strategy.id,
				];
				const invocation: PlannerStrategyInvocationDiagnostic = {
					depth,
					goal: problem.activeGoal,
					index: state.nextInvocationIndex,
					outcome: "running",
					...(parent === undefined
						? {}
						: {
								parentInvocationIndex: parent.invocationIndex,
							}),
					path,
					reason,
					strategyId: strategy.id,
				};
				return [
					{
						invocation,
					},
					{
						invocations: [
							...state.invocations,
							invocation,
						],
						nextInvocationIndex: state.nextInvocationIndex + 1,
					},
				];
			},
		);

		const currentStrategy = {
			depth,
			id: strategy.id,
			invocationIndex: claim.invocation.index,
			...(claim.invocation.parentInvocationIndex === undefined
				? {}
				: {
						parentInvocationIndex: claim.invocation.parentInvocationIndex,
					}),
			path: claim.invocation.path,
			reason,
		};
		return yield* strategy.solveFx(problem).pipe(
			Effect.provideService(PlannerBudgetFx, budget),
			Effect.provideService(PlannerCurrentStrategyFx, currentStrategy),
			Effect.tap((result) =>
				result.type !== "completed"
					? Effect.void
					: readPlannerItemGoalStatusFx(
							problem.activeGoal,
							result.execution.runtime,
						).pipe(
							Effect.flatMap((status) =>
								status.satisfied
									? Effect.void
									: Effect.die(
											new Error(
												`Planner strategy ${strategy.id} reported completion with ${status.availableQuantity}/${problem.activeGoal.quantity} ${problem.activeGoal.itemId} and ${status.availableCharges}/${status.minimumCharges} charges.`,
											),
										),
							),
						),
			),
			Effect.tap((result) =>
				Ref.update(stateRef, (state) =>
					updateInvocationOutcome(state, claim.invocation.index, result.type),
				),
			),
			Effect.tapError(() =>
				Ref.update(stateRef, (state) =>
					updateInvocationOutcome(state, claim.invocation.index, "failed"),
				),
			),
		);
	});

	const service: PlannerSessionFxService = {
		readDiagnosticsFx: Effect.all({
			budgetSnapshot: budget.read,
			state: Ref.get(stateRef),
		}).pipe(
			Effect.map(
				({ budgetSnapshot, state }): PlannerSessionDiagnostics => ({
					budget: {
						limits: budget.limits,
						snapshot: budgetSnapshot,
					},
					invocations: state.invocations,
				}),
			),
		),
		runStrategyFx,
		solveSubgoalFx: Effect.fn("PlannerSession.solveSubgoalFx")((request) =>
			Effect.gen(function* () {
				const problem = yield* createPlannerSubproblemFx(request);
				return yield* runStrategyFx({
					problem,
					reason: request.reason,
					strategy: rootStrategy,
				});
			}),
		),
	};
	return service;
});
