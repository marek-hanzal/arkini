import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { clearItemJobQueueFx } from "~/production-job/write/clearItemJobQueueFx";
import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import {
	clearItemJobQueueConfig,
	clearItemJobQueueState,
} from "~test/production-job/write/clearItemJobQueueFx.test/fixture";

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
});
