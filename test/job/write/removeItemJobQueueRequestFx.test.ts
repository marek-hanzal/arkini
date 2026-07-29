import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { removeItemJobQueueRequestFx } from "~/engine/job/write/removeItemJobQueueRequestFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig(3);
const state = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
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

const runRemoval = (ownerItemId: string, requestId: string) =>
	Effect.runSync(
		Effect.gen(function* () {
			const before = yield* readRuntimeFx();
			const removed = yield* removeItemJobQueueRequestFx({
				ownerItemId,
				requestId,
			});
			const after = yield* readRuntimeFx();
			return {
				after,
				before,
				removed,
			};
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);

describe("removeItemJobQueueRequestFx", () => {
	it("removes one exact owned request while preserving FIFO siblings and active work", () => {
		const result = runRemoval("runtime:forge:primary", "job:queued:first");

		expect(result.removed?.id).toBe("job:queued:first");
		expect(result.after.jobs).toEqual(result.before.jobs);
		expect(result.after.items).toEqual(result.before.items);
		expect(result.after.jobQueue?.map((request) => request.id)).toEqual([
			"job:queued:other",
			"job:queued:second",
		]);
	});

	it("does not remove a request through the wrong owner identity", () => {
		const result = runRemoval("runtime:forge:other", "job:queued:first");

		expect(result.removed).toBeUndefined();
		expect(result.after).toEqual(result.before);
	});
});
