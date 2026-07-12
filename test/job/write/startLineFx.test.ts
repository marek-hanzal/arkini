import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readLineRunFx } from "~/v1/line/fx/run/readLineRunFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { setItemQuantityFx } from "~/v1/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
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
				return {
					started,
					runtime,
					preview,
					state,
					restored,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.started.job.dueAtMs - result.started.job.startedAtMs).toBe(1_000);
		expect(result.runtime.jobs).toEqual([
			result.started.job,
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
						scope: "job",
						jobId: result.started.job.id,
					},
				}),
			]),
		);
		expect(result.preview.ready).toBe(true);
		expect(result.state.jobs).toEqual([
			result.started.job,
		]);
		expect(result.restored).toEqual(result.runtime);
	});

	it("keeps job-scoped reservations immutable through generic item commands", () => {
		const config = createJobTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const started = yield* startLineFx(startProps);
				const before = yield* readRuntimeFx();
				const reserved = before.items.find((item) => {
					return item.location.scope === "job" && item.location.jobId === started.job.id;
				});
				if (reserved === undefined) {
					return yield* Effect.dieMessage("Expected one job-scoped reservation.");
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
				jobId: result.started.job.id,
			});
		}
		expect(Either.isLeft(result.quantity)).toBe(true);
		if (Either.isLeft(result.quantity)) {
			expect(result.quantity.left).toMatchObject({
				_tag: "ItemJobScopedError",
				itemId: result.reserved.id,
				jobId: result.started.job.id,
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
		expect(result.runtime.jobs).toHaveLength(2);
		expect(result.runtime.items.filter((item) => item.item.id === "water")).toHaveLength(0);
		expect(
			result.runtime.items.filter(
				(item) => item.item.id === "tool" && item.location.scope === "job",
			),
		).toHaveLength(2);
	});
	it("schedules queued jobs sequentially instead of running them concurrently", () => {
		const config = createJobTestConfig(2);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const first = yield* startLineFx(startProps);
				const second = yield* startLineFx(startProps);
				return {
					first: first.job,
					second: second.job,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.second.startedAtMs).toBe(result.first.dueAtMs);
		expect(result.second.dueAtMs - result.second.startedAtMs).toBe(1_000);
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
