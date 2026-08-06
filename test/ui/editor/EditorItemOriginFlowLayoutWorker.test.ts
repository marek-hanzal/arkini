import { Cause, Deferred, Effect, Exit, Fiber, Option, Scope } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";
import {
	makeEditorItemOriginFlowLayoutWorkerOwnerFx,
	type EditorItemOriginFlowLayoutWorkerRequest,
	type EditorItemOriginFlowLayoutWorkerResponse,
} from "~/ui/item/editor/EditorItemOriginFlowLayoutWorker";

const flow: EditorItemOriginFlow = {
	edges: [],
	nodes: [
		{
			depth: 0,
			id: "item:wine",
			itemId: "wine",
			kind: "item",
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

class TestWorker extends EventTarget {
	readonly requests: EditorItemOriginFlowLayoutWorkerRequest[] = [];
	terminateCount = 0;
	#readyScheduled = false;

	constructor(
		readonly onRequest?: (
			request: EditorItemOriginFlowLayoutWorkerRequest,
			worker: TestWorker,
		) => void,
	) {
		super();
	}

	override addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: AddEventListenerOptions | boolean,
	): void {
		super.addEventListener(type, callback, options);
		if (type !== "message" || this.#readyScheduled) return;
		this.#readyScheduled = true;
		queueMicrotask(() =>
			this.#emit([
				0,
			]),
		);
	}

	postMessage(
		message: readonly [
			number,
			unknown,
		],
	): void {
		if (message[0] !== 0) return;
		const request = message[1] as EditorItemOriginFlowLayoutWorkerRequest;
		this.requests.push(request);
		this.onRequest?.(request, this);
	}

	respond(response: EditorItemOriginFlowLayoutWorkerResponse): void {
		this.#emit([
			1,
			response,
		]);
	}

	terminate(): void {
		this.terminateCount += 1;
	}

	#emit(data: unknown): void {
		this.dispatchEvent(
			new MessageEvent("message", {
				data,
			}),
		);
	}
}

const asWorker = (worker: TestWorker) => worker as unknown as Worker;

describe("EditorItemOriginFlowLayoutWorker", () => {
	it("returns worker positions, sends only topology, and terminates the worker", async () => {
		const worker = new TestWorker((request, target) =>
			target.respond({
				generation: request.generation,
				positions: [
					[
						"item:wine",
						{
							height: 76,
							width: 224,
							x: 12,
							y: 24,
						},
					],
				],
				type: "success",
			}),
		);

		const positions = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const owner = yield* makeEditorItemOriginFlowLayoutWorkerOwnerFx({
						spawn: () => asWorker(worker),
					});
					return yield* owner.layoutFx(flow);
				}),
			),
		);

		expect(positions.get("item:wine")?.x).toBe(12);
		expect(worker.requests).toEqual([
			{
				generation: 1,
				topology: {
					edges: [],
					nodes: [
						{
							id: "item:wine",
							kind: "item",
							starter: false,
						},
					],
				},
			},
		]);
		expect(worker.terminateCount).toBeGreaterThanOrEqual(1);
	});

	it("physically terminates and interrupts a superseded layout", async () => {
		const firstRequested = Effect.runSync(Deferred.make<void>());
		const firstWorker = new TestWorker(() => {
			Deferred.doneUnsafe(firstRequested, Effect.void);
		});
		const secondWorker = new TestWorker((request, target) =>
			target.respond({
				generation: request.generation,
				positions: [],
				type: "success",
			}),
		);
		const workers = [
			firstWorker,
			secondWorker,
		];

		const firstExit = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const owner = yield* makeEditorItemOriginFlowLayoutWorkerOwnerFx({
						spawn: () => asWorker(workers.shift() as TestWorker),
					});
					const first = yield* Effect.forkChild(owner.layoutFx(flow));
					yield* Deferred.await(firstRequested);
					yield* owner.layoutFx(flow);
					return yield* Fiber.await(first);
				}),
			),
		);

		expect(Exit.isFailure(firstExit) && Cause.hasInterruptsOnly(firstExit.cause)).toBe(true);
		expect(firstWorker.terminateCount).toBeGreaterThanOrEqual(1);
		expect(secondWorker.terminateCount).toBeGreaterThanOrEqual(1);
	});

	it("terminates an active layout when the owner scope closes", async () => {
		const requested = Effect.runSync(Deferred.make<void>());
		const worker = new TestWorker(() => {
			Deferred.doneUnsafe(requested, Effect.void);
		});
		const scope = Effect.runSync(Scope.make());
		const owner = await Effect.runPromise(
			makeEditorItemOriginFlowLayoutWorkerOwnerFx({
				spawn: () => asWorker(worker),
			}).pipe(Scope.provide(scope)),
		);
		const running = Effect.runFork(owner.layoutFx(flow));
		await Effect.runPromise(Deferred.await(requested));

		await Effect.runPromise(Scope.close(scope, Exit.void));
		const exit = await Effect.runPromise(Fiber.await(running));

		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(worker.terminateCount).toBeGreaterThanOrEqual(1);
	});

	it("preserves a worker-reported layout error", async () => {
		const worker = new TestWorker((request, target) =>
			target.respond({
				generation: request.generation,
				message: "layout exploded",
				type: "error",
			}),
		);

		const exit = await Effect.runPromiseExit(
			Effect.scoped(
				Effect.gen(function* () {
					const owner = yield* makeEditorItemOriginFlowLayoutWorkerOwnerFx({
						spawn: () => asWorker(worker),
					});
					return yield* owner.layoutFx(flow);
				}),
			),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const failure = Cause.findErrorOption(exit.cause);
			expect(Option.isSome(failure) && failure.value.message).toBe("layout exploded");
		}
		expect(worker.terminateCount).toBe(1);
	});
});
