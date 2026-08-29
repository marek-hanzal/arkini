import { Cause, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";

import type { EditorItemEstimate } from "~/estimate/domain/EditorItemEstimate";
import type { EditorItemEstimateWorkerRequest } from "~/estimate/worker/editorItemEstimateWorkerProtocol";
import { runEditorItemEstimateInWorkerFx } from "~/estimate/worker/runEditorItemEstimateInWorkerFx";

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
	} as EditorItemEstimateWorkerRequest["config"],
} satisfies EditorItemEstimateWorkerRequest;
const estimate: EditorItemEstimate = {
	diagnostics: [],
	factId: "alpha",
	limitations: [],
	obtainable: false,
	status: "unreachable",
	quantity: 1,
};

describe("runEditorItemEstimateInWorkerFx", () => {
	it.effect("returns the worker batch and terminates the worker", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			const result = yield* runEditorItemEstimateInWorkerFx(request, {
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
			const running = yield* runEditorItemEstimateInWorkerFx(request, {
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
				runEditorItemEstimateInWorkerFx(request, {
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
