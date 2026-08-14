import { Effect, Ref } from "effect";

import {
	DefaultPlannerBudgetLimits,
	PlannerBudgetCounter,
	PlannerBudgetExceeded,
	type PlannerBudgetFxService,
	type PlannerBudgetLimits,
	type PlannerBudgetSnapshot,
} from "~/editor/planner/PlannerBudget";

const readLimit = (limits: PlannerBudgetLimits, counter: PlannerBudgetCounter) => {
	switch (counter) {
		case PlannerBudgetCounter.engineTransitions:
			return limits.maximumEngineTransitions;
		case PlannerBudgetCounter.strategyInvocations:
			return limits.maximumStrategyInvocations;
	}
};

const readValue = (snapshot: PlannerBudgetSnapshot, counter: PlannerBudgetCounter) => {
	switch (counter) {
		case PlannerBudgetCounter.engineTransitions:
			return snapshot.engineTransitions;
		case PlannerBudgetCounter.strategyInvocations:
			return snapshot.strategyInvocations;
	}
};

const writeValue = (
	snapshot: PlannerBudgetSnapshot,
	counter: PlannerBudgetCounter,
	value: number,
): PlannerBudgetSnapshot => {
	switch (counter) {
		case PlannerBudgetCounter.engineTransitions:
			return {
				...snapshot,
				engineTransitions: value,
			};
		case PlannerBudgetCounter.strategyInvocations:
			return {
				...snapshot,
				strategyInvocations: value,
			};
	}
};

export const createPlannerBudgetFx = Effect.fn("createPlannerBudgetFx")(function* (
	input: Partial<PlannerBudgetLimits> = {},
) {
	const limits: PlannerBudgetLimits = {
		...DefaultPlannerBudgetLimits,
		...input,
	};
	for (const [name, value] of Object.entries(limits)) {
		if (!Number.isSafeInteger(value) || value < 1)
			return yield* Effect.die(
				new RangeError(`Planner budget ${name} must be a positive safe integer.`),
			);
	}
	const initial: PlannerBudgetSnapshot = {
		engineTransitions: 0,
		strategyInvocations: 0,
	};
	const state = yield* Ref.make(initial);
	return {
		assertDelegationDepthFx: (depth) =>
			depth <= limits.maximumDelegationDepth
				? Effect.void
				: Effect.fail(
						new PlannerBudgetExceeded({
							attempted: depth,
							counter: "delegation-depth",
							limit: limits.maximumDelegationDepth,
						}),
					),
		consumeFx: (counter, amount = 1) =>
			Effect.gen(function* () {
				if (!Number.isSafeInteger(amount) || amount < 1)
					return yield* Effect.die(
						new RangeError(
							"Planner budget consumption must be a positive safe integer.",
						),
					);
				const outcome = yield* Ref.modify(state, (snapshot) => {
					const attempted = readValue(snapshot, counter) + amount;
					const limit = readLimit(limits, counter);
					const next = writeValue(snapshot, counter, attempted);
					return attempted > limit
						? [
								{
									attempted,
									limit,
									type: "exceeded" as const,
								},
								snapshot,
							]
						: [
								{
									snapshot: next,
									type: "consumed" as const,
								},
								next,
							];
				});
				if (outcome.type === "exceeded")
					return yield* new PlannerBudgetExceeded({
						attempted: outcome.attempted,
						counter,
						limit: outcome.limit,
					});
				return outcome.snapshot;
			}),
		limits,
		read: Ref.get(state),
	} satisfies PlannerBudgetFxService;
});
