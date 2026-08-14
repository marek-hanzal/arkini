import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { PlannerBudgetCounter, PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import { createPlannerBudgetFx } from "~/editor/planner/createPlannerBudgetFx";

describe("createPlannerBudgetFx", () => {
	it("shares atomic counters across strategy work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const budget = yield* createPlannerBudgetFx({
					maximumEngineTransitions: 2,
					maximumStrategyInvocations: 3,
				});
				yield* budget.consumeFx(PlannerBudgetCounter.strategyInvocations);
				yield* budget.consumeFx(PlannerBudgetCounter.engineTransitions, 2);
				return yield* budget.read;
			}),
		);
		expect(result).toEqual({
			engineTransitions: 2,
			strategyInvocations: 1,
		});
	});

	it("does not spend a counter when its global limit is exceeded", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const budget = yield* createPlannerBudgetFx({
					maximumEngineTransitions: 1,
				});
				yield* budget.consumeFx(PlannerBudgetCounter.engineTransitions);
				const exit = yield* Effect.exit(
					budget.consumeFx(PlannerBudgetCounter.engineTransitions),
				);
				return {
					exit,
					snapshot: yield* budget.read,
				};
			}),
		);
		expect(result.exit._tag).toBe("Failure");
		expect(result.snapshot.engineTransitions).toBe(1);
	});

	it("guards nested strategy delegation separately from work counters", () => {
		const error = Effect.runSync(
			Effect.gen(function* () {
				const budget = yield* createPlannerBudgetFx({
					maximumDelegationDepth: 2,
				});
				return yield* Effect.flip(budget.assertDelegationDepthFx(3));
			}),
		);
		expect(error).toBeInstanceOf(PlannerBudgetExceeded);
		expect(error.counter).toBe("delegation-depth");
	});
});
