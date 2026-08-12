import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { PlannerGamePolicyLayerFx } from "~/engine/game/layer/PlannerGamePolicyLayerFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { advanceRuntimeStepFx } from "~/engine/tick/internal/advanceRuntimeStepFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";
import { createTemporaryLifetimeTestConfig } from "~test/item/temporary/support/createTemporaryLifetimeTestConfig";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { startLineFx } from "~test/job/support/startLineTestFx";

const runJobStep = (planner: boolean) => {
	const program = Effect.gen(function* () {
		yield* prepareJobLineFx();
		const started = yield* startLineFx({
			lineId: "line:forge:run",
			ownerItemId: "runtime:forge",
		});
		const step = yield* advanceRuntimeStepFx(yield* readRuntimeFx());
		return {
			durationMs: started.job.durationMs,
			step,
		};
	});
	return Effect.runSync(
		(planner ? program.pipe(Effect.provide(PlannerGamePolicyLayerFx)) : program).pipe(
			useGameFx({
				config: createJobTestConfig(),
			}),
		),
	);
};

const runTemporaryStep = (planner: boolean) => {
	const program = Effect.gen(function* () {
		const temporary = yield* spawnItemFx({
			id: "runtime:temporary",
			itemId: "temporaryPlain",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		});
		const step = yield* advanceRuntimeStepFx(yield* readRuntimeFx());
		return {
			step,
			temporary,
		};
	});
	return Effect.runSync(
		(planner ? program.pipe(Effect.provide(PlannerGamePolicyLayerFx)) : program).pipe(
			useGameFx({
				config: createTemporaryLifetimeTestConfig(),
			}),
		),
	);
};

describe("RuntimeTimePolicyFx", () => {
	it("completes a runnable planner job in one step without changing canonical timing or authored duration", () => {
		const canonical = runJobStep(false);
		const planner = runJobStep(true);

		expect(canonical.durationMs).toBe(1_000);
		expect(canonical.step.runtime.jobs).toMatchObject([
			{
				durationMs: 1_000,
				remainingMs: 1_000 - TickStepMs,
			},
		]);
		expect(planner.durationMs).toBe(1_000);
		expect(planner.step.runtime.jobs).toEqual([]);
	});

	it("keeps temporary expiry explicit for the planner without changing canonical aging", () => {
		const canonical = runTemporaryStep(false);
		const planner = runTemporaryStep(true);

		expect(canonical.temporary.remainingDurationMs).toBe(600);
		expect(canonical.step.runtime.items[0]?.remainingDurationMs).toBe(600 - TickStepMs);
		expect(planner.temporary.remainingDurationMs).toBe(600);
		expect(planner.step.runtime.items[0]?.remainingDurationMs).toBe(600);
	});
});
