import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import type { StartLineResultSchema } from "~/v1/job/schema/StartLineResultSchema";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readLineRunFx } from "~/v1/line/fx/run/readLineRunFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { setItemQuantityFx } from "~/v1/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

const readStartedJob = (result: StartLineResultSchema.Type) => {
	if (result.type !== "started") {
		throw new Error("Expected an immediately started job.");
	}
	return result.job;
};

describe("startLineFx", () => {
	it("atomically consumes, reserves, and creates one persistent job", () => {
		const config = createJobTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const started = yield* startLineFx(startProps);
				const runtime = yield* readRuntimeFx();
				const preview = yield* readLineRunFx(startProps);
				const state = yield* fromRuntimeFx({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				const restoredState = yield* fromRuntimeFx({
					runtime: restored,
				});
				return {
					started,
					runtime,
					preview,
					state,
					restored,
					restoredState,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(readStartedJob(result.started).durationMs).toBe(1_000);
		expect(result.runtime.jobs).toEqual([
			readStartedJob(result.started),
		]);
		expect(result.runtime.items.find((item) => item.item.id === "water")).toMatchObject({
			quantity: 3,
			location: {
				scope: "input",
				inputIndex: 0,
			},
		});
		const tools = result.runtime.items.filter((item) => item.item.id === "tool");
		expect(tools).toHaveLength(2);
		expect(tools).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					quantity: 1,
					location: expect.objectContaining({
						scope: "input",
						inputIndex: 1,
					}),
				}),
				expect.objectContaining({
					quantity: 1,
					location: {
						scope: "reserved",
						jobId: readStartedJob(result.started).id,
					},
				}),
			]),
		);
		expect(result.preview.ready).toBe(true);
		expect(result.state.jobs).toEqual([
			readStartedJob(result.started),
		]);
		expect(result.restoredState).toEqual(result.state);
		for (const item of result.runtime.items) {
			const restoredItem = result.restored.items.find(
				(candidate) => candidate.id === item.id,
			);
			expect(restoredItem?.revision).toMatch(/^revision:/);
			expect(restoredItem?.revision).not.toBe(item.revision);
		}
	});

	it("keeps job-scoped reservations immutable through generic item commands", () => {
		const config = createJobTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const started = yield* startLineFx(startProps);
				const before = yield* readRuntimeFx();
				const reserved = before.items.find((item) => {
					return (
						item.location.scope === "reserved" &&
						item.location.jobId === readStartedJob(started).id
					);
				});
				if (reserved === undefined) {
					return yield* Effect.dieMessage("Expected one reserved runtime item.");
				}

				const removed = yield* Effect.either(
					removeItemFx({
						itemId: reserved.id,
						revision: reserved.revision,
					}),
				);
				const quantity = yield* Effect.either(
					setItemQuantityFx({
						itemId: reserved.id,
						quantity: reserved.quantity + 1,
						revision: reserved.revision,
					}),
				);
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					quantity,
					removed,
					reserved,
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result.removed)).toBe(true);
		if (Either.isLeft(result.removed)) {
			expect(result.removed.left).toMatchObject({
				_tag: "ItemJobScopedError",
				itemId: result.reserved.id,
				jobId: readStartedJob(result.started).id,
			});
		}
		expect(Either.isLeft(result.quantity)).toBe(true);
		if (Either.isLeft(result.quantity)) {
			expect(result.quantity.left).toMatchObject({
				_tag: "ItemJobScopedError",
				itemId: result.reserved.id,
				jobId: readStartedJob(result.started).id,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("serializes concurrent starts against one queue slot", async () => {
		const config = createJobTestConfig(1);
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const attempts = yield* Effect.all(
					[
						Effect.either(startLineFx(startProps)),
						Effect.either(startLineFx(startProps)),
					],
					{
						concurrency: "unbounded",
					},
				);
				const runtime = yield* readRuntimeFx();
				return {
					attempts,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempts.filter(Either.isRight)).toHaveLength(1);
		expect(result.attempts.filter(Either.isLeft)).toHaveLength(1);
		const failure = result.attempts.find(Either.isLeft);
		expect(failure && Either.isLeft(failure) ? failure.left : undefined).toMatchObject({
			_tag: "JobQueueFullError",
			maxQueueSize: 1,
		});
		expect(result.runtime.jobs).toHaveLength(1);
	});

	it("lets two concurrent starts consume disjoint allocations when queue capacity permits", async () => {
		const config = createJobTestConfig(2);
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const attempts = yield* Effect.all(
					[
						Effect.either(startLineFx(startProps)),
						Effect.either(startLineFx(startProps)),
					],
					{
						concurrency: "unbounded",
					},
				);
				const runtime = yield* readRuntimeFx();
				return {
					attempts,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempts.every(Either.isRight)).toBe(true);
		expect(result.runtime.jobs).toHaveLength(1);
		expect(result.runtime.jobQueue).toHaveLength(1);
		expect(result.runtime.items.find((item) => item.item.id === "water")).toMatchObject({
			quantity: 3,
		});
		expect(
			result.runtime.items.filter(
				(item) => item.item.id === "tool" && item.location.scope === "reserved",
			),
		).toHaveLength(1);
	});
	it("schedules queued jobs sequentially instead of running them concurrently", () => {
		const config = createJobTestConfig(2);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const first = yield* startLineFx(startProps);
				const second = yield* startLineFx(startProps);
				return {
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.first.type).toBe("started");
		expect(result.second.type).toBe("queued");
	});

	it("never starts ahead of an existing blocked FIFO request", () => {
		const config = createJobTestConfig(3);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx(startProps);
				const queued = yield* startLineFx(startProps);
				if (queued.type !== "queued") throw new Error("Expected queued request.");

				const runtime = yield* readRuntimeFx();
				const water = runtime.items.find(
					(item) => item.item.id === "water" && item.location.scope === "input",
				);
				if (water === undefined) throw new Error("Expected buffered water.");
				yield* removeItemFx({
					itemId: water.id,
					revision: water.revision,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 1_000,
				});

				const refill = yield* spawnItemFx({
					id: "runtime:water:refill",
					itemId: "water",
					location: {
						scope: "board",
						position: {
							x: 3,
							y: 0,
						},
					},
					quantity: 3,
				});
				yield* storeInputMaterialFx({
					ownerItemId: startProps.ownerItemId,
					lineId: startProps.lineId,
					inputIndex: 0,
					sourceItemId: refill.id,
					sourceItemRevision: refill.revision,
					quantity: 3,
				});

				const newer = yield* startLineFx(startProps);
				const queuedRuntime = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					afterDispatch: yield* readRuntimeFx(),
					newer,
					queued,
					queuedRuntime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.newer.type).toBe("queued");
		expect(result.queuedRuntime.jobs).toEqual([]);
		expect(result.queuedRuntime.jobQueue).toHaveLength(2);
		expect((result.queuedRuntime.jobQueue ?? [])[0]?.id).toBe(result.queued.request.id);
		if (result.newer.type === "queued") {
			expect((result.queuedRuntime.jobQueue ?? [])[1]?.id).toBe(result.newer.request.id);
			expect(result.afterDispatch.jobs).toHaveLength(1);
			expect(result.afterDispatch.jobs[0]?.remainingMs).toBe(800);
			expect(result.afterDispatch.jobQueue).toHaveLength(1);
			expect((result.afterDispatch.jobQueue ?? [])[0]?.id).toBe(result.newer.request.id);
		}
	});

	it("rejects an unavailable line without partially creating a job", () => {
		const config = createJobTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:forge",
					itemId: "forge",
					location: {
						scope: "board",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const attempt = yield* Effect.either(startLineFx(startProps));
				const runtime = yield* readRuntimeFx();
				return {
					attempt,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "LineRunUnavailableError",
				ownerItemId: startProps.ownerItemId,
				lineId: startProps.lineId,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items).toHaveLength(1);
	});

	it("lets the input buffer refill while prior material is reserved by a job", () => {
		const config = createJobTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx(startProps);
				const extra = yield* spawnItemFx({
					id: "runtime:tool:extra",
					itemId: "tool",
					location: {
						scope: "board",
						position: {
							x: 3,
							y: 0,
						},
					},
					quantity: 1,
				});
				const store = yield* Effect.either(
					storeInputMaterialFx({
						ownerItemId: startProps.ownerItemId,
						lineId: startProps.lineId,
						inputIndex: 1,
						sourceItemId: extra.id,
						sourceItemRevision: extra.revision,
						quantity: 1,
					}),
				);
				return store;
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isRight(result)).toBe(true);
	});
});
