import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	clearItemJobQueueConfig,
	clearItemJobQueueState,
} from "~test/production-job/fx/clearItemJobQueueFx.test/fixture";

const queuedAutofillConfig = createJobTestConfig(1);

const prepareBlockedReserveQueueFx = Effect.fn("prepareBlockedReserveQueueFx")(function* () {
	const owner = yield* spawnItemFx({
		id: "runtime:forge",
		itemId: "forge",
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
	const tool = yield* spawnItemFx({
		id: "runtime:tool",
		itemId: "tool",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
		quantity: 1,
	});
	const request = yield* enqueueLineFx({
		ownerItemId: owner.id,
		lineId: "line:forge:run",
	});
	return {
		owner,
		request,
		tool,
	};
});

describe("clearItemJobQueueFx", () => {
	it("clears all and only the owner's pending requests without changing active work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const cleared = yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				return {
					after: yield* readRuntimeFx(),
					before,
					cleared,
				};
			}).pipe(
				useGameFx({
					config: clearItemJobQueueConfig,
					state: clearItemJobQueueState,
				}),
			),
		);

		expect(result.cleared.map(({ id }) => id)).toEqual([
			"job:queued:first",
			"job:queued:second",
		]);
		expect(result.after.jobs).toEqual(result.before.jobs);
		expect(result.after.items).toEqual(result.before.items);
		expect(result.after.jobQueue?.map(({ id }) => id)).toEqual([
			"job:queued:other:first",
			"job:queued:other:second",
		]);
	});

	it("re-enqueues cleared work with a fresh identity at the end of global accepted order", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const cleared = yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				const requeued = yield* enqueueLineFx({
					ownerItemId: "runtime:forge:primary",
					lineId: "line:forge:run",
				});
				return {
					after: yield* readRuntimeFx(),
					cleared,
					requeued,
				};
			}).pipe(
				useGameFx({
					config: clearItemJobQueueConfig,
					state: clearItemJobQueueState,
				}),
			),
		);

		const clearedIds = result.cleared.map(({ id }) => id);
		expect(clearedIds).toEqual([
			"job:queued:first",
			"job:queued:second",
		]);
		expect(clearedIds).not.toContain(result.requeued.id);
		expect(result.after.jobQueue?.map(({ id }) => id)).toEqual([
			"job:queued:other:first",
			"job:queued:other:second",
			result.requeued.id,
		]);
	});

	it("repeats as an exact no-op once the owner queue is empty", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				const beforeSecondClear = yield* readRuntimeFx();
				const cleared = yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				return {
					afterSecondClear: yield* readRuntimeFx(),
					beforeSecondClear,
					cleared,
				};
			}).pipe(
				useGameFx({
					config: clearItemJobQueueConfig,
					state: clearItemJobQueueState,
				}),
			),
		);

		expect(result.cleared).toEqual([]);
		expect(result.afterSecondClear).toBe(result.beforeSecondClear);
		expect(result.afterSecondClear.jobs).toEqual(clearItemJobQueueState.jobs);
	});

	it("returns a settled reserve input when clearing its blocked pending work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareBlockedReserveQueueFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 300,
				});
				const buffered = yield* readRuntimeFx();
				const cleared = yield* clearItemJobQueueFx({
					ownerItemId: prepared.owner.id,
				});
				return {
					after: yield* readRuntimeFx(),
					buffered,
					cleared,
					prepared,
				};
			}).pipe(
				useGameFx({
					config: queuedAutofillConfig,
				}),
			),
		);

		expect(result.buffered.jobs).toEqual([]);
		expect(
			result.buffered.items.find((item) => item.id === result.prepared.tool.id)?.location,
		).toMatchObject({
			ownerItemId: result.prepared.owner.id,
			scope: "input",
		});
		expect(result.cleared.map(({ id }) => id)).toEqual([
			result.prepared.request.id,
		]);
		expect(result.after.jobQueue).toEqual([]);
		expect(result.after.items.find((item) => item.item.id === "tool")?.location).toMatchObject({
			scope: "board",
		});
	});

	it("returns an in-flight reserve input when clearing before delivery settlement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareBlockedReserveQueueFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const outbound = yield* readRuntimeFx();
				yield* clearItemJobQueueFx({
					ownerItemId: prepared.owner.id,
				});
				const returning = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 300,
				});
				return {
					after: yield* readRuntimeFx(),
					outbound,
					prepared,
					returning,
				};
			}).pipe(
				useGameFx({
					config: queuedAutofillConfig,
				}),
			),
		);

		expect(
			result.outbound.items.find((item) => item.id === result.prepared.tool.id)?.location,
		).toMatchObject({
			phase: "outbound",
			scope: "delivery",
		});
		expect(result.returning.jobQueue).toEqual([]);
		expect(
			result.returning.items.find((item) => item.id === result.prepared.tool.id)?.location,
		).toMatchObject({
			phase: "returning",
			scope: "delivery",
		});
		expect(
			result.after.items.find((item) => item.id === result.prepared.tool.id)?.location,
		).toEqual(result.prepared.tool.location);
	});
});
