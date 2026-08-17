import { Cause, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";
import type { EditorItemEstimateWorkerRequest } from "~/ui/item/editor/editorItemEstimateWorkerProtocol";
import { runEditorItemEstimateInWorkerFx } from "~/ui/item/editor/runEditorItemEstimateInWorkerFx";

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
	rejectedRoutes: [],
};

describe("runEditorItemEstimateInWorkerFx", () => {
	it("returns the worker batch and terminates the worker", async () => {
		const worker = new TestWorker();
		const result = await Effect.runPromise(
			runEditorItemEstimateInWorkerFx(request, {
				runEstimate: async () => ({
					estimates: [
						estimate,
					],
				}),
				spawn: () => asWorker(worker),
			}),
		);

		expect(result.estimates).toEqual([
			estimate,
		]);
		expect(worker.terminateCount).toBe(1);
	});

	it("terminates an active worker when interrupted", async () => {
		const worker = new TestWorker();
		const running = Effect.runFork(
			runEditorItemEstimateInWorkerFx(request, {
				runEstimate: () => new Promise(() => undefined),
				spawn: () => asWorker(worker),
			}),
		);

		await Effect.runPromise(Fiber.interrupt(running));
		const exit = await Effect.runPromise(Fiber.await(running));

		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(worker.terminateCount).toBe(1);
	});

	it("preserves a worker error and still terminates the worker", async () => {
		const worker = new TestWorker();
		const exit = await Effect.runPromiseExit(
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
	});
});
