import { Cause, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import { layoutEditorItemOriginFlowInWorkerFx } from "~/ui/item/editor/layoutEditorItemOriginFlowInWorkerFx";
import type {
	EditorItemOriginFlowLayout,
	EditorItemOriginFlowLayoutInput,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";

const flow: EditorItemOriginFlow = {
	edges: [],
	nodes: [
		{
			acquisitionSourceId: undefined,
			depth: 0,
			id: "item:wine",
			itemId: "wine",
			kind: "item",
			operations: [],
			resourceIds: [
				"wine",
			],
			starterScopes: [],
			status: "reachable",
			title: "Wine",
			type: "producer",
		},
	],
	obtainable: true,
};

class TestWorker {
	terminateCount = 0;

	terminate(): void {
		this.terminateCount += 1;
	}
}

const asWorker = (worker: TestWorker) => worker as unknown as Worker;

describe("layoutEditorItemOriginFlowInWorkerFx", () => {
	it("passes only topology to the layout and terminates its worker", async () => {
		const worker = new TestWorker();
		let received: EditorItemOriginFlowLayoutInput | undefined;
		const layout: EditorItemOriginFlowLayout = {
			positions: new Map([
				[
					"item:wine",
					{
						flowOrder: 0,
						height: 176,
						width: 420,
						x: 12,
						y: 24,
					},
				],
			]),
			routes: new Map(),
		};

		const result = await Effect.runPromise(
			layoutEditorItemOriginFlowInWorkerFx(flow, {
				runLayout: async (topology) => {
					received = topology;
					return layout;
				},
				spawn: () => asWorker(worker),
			}),
		);

		expect(result.positions.get("item:wine")?.x).toBe(12);
		expect(received).toEqual({
			edges: [],
			nodes: [
				{
					height: 176,
					id: "item:wine",
					ports: [],
					width: 420,
				},
			],
		});
		expect(worker.terminateCount).toBe(1);
	});

	it("terminates an active worker when interrupted", async () => {
		const worker = new TestWorker();
		const running = Effect.runFork(
			layoutEditorItemOriginFlowInWorkerFx(flow, {
				runLayout: () => new Promise(() => undefined),
				spawn: () => asWorker(worker),
			}),
		);

		await Effect.runPromise(Fiber.interrupt(running));
		const exit = await Effect.runPromise(Fiber.await(running));

		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(worker.terminateCount).toBe(1);
	});

	it("preserves a layout error", async () => {
		const worker = new TestWorker();
		const exit = await Effect.runPromiseExit(
			layoutEditorItemOriginFlowInWorkerFx(flow, {
				runLayout: () => Promise.reject(new Error("layout exploded")),
				spawn: () => asWorker(worker),
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const failure = Cause.findErrorOption(exit.cause);
			expect(Option.isSome(failure) && failure.value.message).toBe("layout exploded");
		}
		expect(worker.terminateCount).toBe(1);
	});
});
