import { Cause, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";

import type { ItemEstimate } from "~/estimate/type/ItemEstimate";
import type { ItemEstimateWorkerRequest } from "~/estimate/worker/itemEstimateWorkerProtocol";
import { runItemEstimateInWorkerFx } from "~/estimate/worker/runItemEstimateInWorkerFx";

class TestWorker {
	terminateCount = 0;

	terminate(): void {
		this.terminateCount += 1;
	}
}

const asWorker = (worker: TestWorker) => worker as unknown as Worker;
const request = {
	config: {
		items: {},
	} as ItemEstimateWorkerRequest["config"],
} satisfies ItemEstimateWorkerRequest;
const estimate: ItemEstimate = {
	diagnostics: [],
	factId: "alpha",
	limitations: [],
	obtainable: false,
	status: "unreachable",
	quantity: 1,
};

describe("runItemEstimateInWorkerFx", () => {
	it.effect("returns the worker batch and terminates the worker", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			const result = yield* runItemEstimateInWorkerFx(request, {
				runEstimate: async () => ({
					estimates: [
						estimate,
					],
				}),
				spawn: () => asWorker(worker),
			});

			expect(result.estimates).toEqual([
				estimate,
			]);
			expect(worker.terminateCount).toBe(1);
		}),
	);

	it.effect("terminates an active worker when interrupted", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			const running = yield* runItemEstimateInWorkerFx(request, {
				runEstimate: () => new Promise(() => undefined),
				spawn: () => asWorker(worker),
			}).pipe(Effect.forkChild);

			yield* Effect.yieldNow;
			yield* Fiber.interrupt(running);
			const exit = yield* Fiber.await(running);

			expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			expect(worker.terminateCount).toBe(1);
		}),
	);

	it.effect("preserves a worker error and still terminates the worker", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			const exit = yield* Effect.exit(
				runItemEstimateInWorkerFx(request, {
					runEstimate: () => Promise.reject(new Error("estimate exploded")),
					spawn: () => asWorker(worker),
				}),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Cause.findErrorOption(exit.cause);
				expect(Option.isSome(failure) && failure.value.message).toBe("estimate exploded");
			}
			expect(worker.terminateCount).toBe(1);
		}),
	);
});
