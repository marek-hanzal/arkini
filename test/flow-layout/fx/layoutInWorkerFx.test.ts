import { Cause, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginFlow,
} from "~/flow/type/EditorItemOriginFlow";
import { layoutInWorkerFx } from "~/flow-layout/fx/layoutInWorkerFx";
import type { Layout, LayoutInput } from "~/flow-layout/type/Layout";

const flow: EditorItemOriginFlow = {
	edges: [],
	nodes: [
		{
			acquisitionSourceId: undefined,
			id: "item:wine",
			itemId: "wine",
			operations: [],
			resourceIds: [
				"wine",
			],
			starterScopes: [],
			title: "Wine",
			type: "producer",
		},
	],
};

class TestWorker {
	terminateCount = 0;

	terminate(): void {
		this.terminateCount += 1;
	}
}

const asWorker = (worker: TestWorker) => worker as unknown as Worker;

describe("layoutInWorkerFx", () => {
	it.effect("passes only topology to the layout and terminates its worker", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			let received: LayoutInput | undefined;
			const layout: Layout = {
				backbones: new Map(),
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
			};

			const result = yield* layoutInWorkerFx(flow, {
				runLayout: async (topology) => {
					received = topology;
					return layout;
				},
				spawn: () => asWorker(worker),
			});

			expect(result.positions.get("item:wine")?.x).toBe(12);
			expect(received).toEqual({
				edges: [],
				nodes: [
					{
						height: 176,
						id: "item:wine",
						ports: [
							{
								id: EditorItemOriginItemInputPortId,
								x: -210,
								y: -21,
							},
							{
								id: EditorItemOriginItemOutputPortId,
								x: 210,
								y: -21,
							},
						],
						type: "producer",
						width: 420,
					},
				],
			});
			expect(worker.terminateCount).toBe(1);
		}),
	);

	it.effect("terminates an active worker when interrupted", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			const running = yield* layoutInWorkerFx(flow, {
				runLayout: () => new Promise(() => undefined),
				spawn: () => asWorker(worker),
			}).pipe(Effect.forkChild);

			yield* Effect.yieldNow;
			yield* Fiber.interrupt(running);
			const exit = yield* Fiber.await(running);

			expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			expect(worker.terminateCount).toBe(1);
		}),
	);

	it.effect("preserves a layout error", () =>
		Effect.gen(function* () {
			const worker = new TestWorker();
			const exit = yield* Effect.exit(
				layoutInWorkerFx(flow, {
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
		}),
	);
});
