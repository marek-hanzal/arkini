import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { clearItemJobQueueFx } from "~/engine/job/write/clearItemJobQueueFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig(3);
const state = {
	currentSpace: 0,
	items: [
		{
			id: "runtime:forge:primary",
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
		},
		{
			id: "runtime:forge:other",
			itemId: "forge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 1,
		},
	],
	jobs: [
		{
			id: "job:active",
			ownerItemId: "runtime:forge:primary",
			lineId: "line:forge:run",
			durationMs: 1_000,
			remainingMs: 800,
		},
	],
	jobQueue: [
		{
			id: "job:queued:first",
			ownerItemId: "runtime:forge:primary",
			lineId: "line:forge:run",
		},
		{
			id: "job:queued:other",
			ownerItemId: "runtime:forge:other",
			lineId: "line:forge:run",
		},
		{
			id: "job:queued:second",
			ownerItemId: "runtime:forge:primary",
			lineId: "line:forge:run",
		},
	],
} satisfies StateSchema.Type;

describe("clearItemJobQueueFx", () => {
	it("clears only the owner's pending requests without touching active work or other queues", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const cleared = yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				const after = yield* readRuntimeFx();
				return {
					after,
					before,
					cleared,
				};
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(result.cleared.map((request) => request.id)).toEqual([
			"job:queued:first",
			"job:queued:second",
		]);
		expect(result.after.jobs).toEqual(result.before.jobs);
		expect(result.after.items).toEqual(result.before.items);
		expect(result.after.jobQueue).toEqual([
			expect.objectContaining({
				id: "job:queued:other",
				ownerItemId: "runtime:forge:other",
			}),
		]);
	});

	it("unlocks a queue-only owner for ordinary removal", () => {
		const queueOnlyState = {
			...state,
			jobs: [],
			jobQueue: [
				{
					id: "job:queued:only",
					ownerItemId: "runtime:forge:primary",
					lineId: "line:forge:run",
				},
			],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const owner = before.items.find((item) => item.id === "runtime:forge:primary");
				if (owner === undefined) {
					return yield* Effect.dieMessage("Expected queue owner.");
				}

				yield* clearItemJobQueueFx({
					ownerItemId: owner.id,
				});
				yield* removeItemFx({
					itemId: owner.id,
					revision: owner.revision,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
					state: queueOnlyState,
				}),
			),
		);

		expect(result.items.some((item) => item.id === "runtime:forge:primary")).toBe(false);
		expect(result.jobQueue).toEqual([]);
	});

	it("is idempotent when the owner has no pending requests", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				const beforeSecondClear = yield* readRuntimeFx();
				const cleared = yield* clearItemJobQueueFx({
					ownerItemId: "runtime:forge:primary",
				});
				const afterSecondClear = yield* readRuntimeFx();
				return {
					afterSecondClear,
					beforeSecondClear,
					cleared,
				};
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(result.cleared).toEqual([]);
		expect(result.afterSecondClear).toEqual(result.beforeSecondClear);
	});
});
