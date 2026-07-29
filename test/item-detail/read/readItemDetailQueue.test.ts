import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailQueueFx } from "~/engine/item-detail/read/readItemDetailQueueFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

describe("readItemDetailQueue", () => {
	it("projects active work before queued intents", () => {
		const base = lineRunRuntime({
			permit: true,
		});
		const runtime = {
			...base,
			jobs: [
				{
					id: "job:active",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 600,
				},
			],
			jobQueue: [
				{
					id: "job:queued",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			Effect.runSync(
				readItemDetailQueueFx({
					itemId: "runtime:workshop",
					runtime,
				}),
			),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			capacity: 2,
			active: [
				{
					jobId: "job:active",
					lineId: "line:workshop:build",
					title: "Build",
					status: "running",
					durationMs: 1_000,
					remainingMs: 600,
				},
			],
			request: [
				{
					requestId: "job:queued",
					lineId: "line:workshop:build",
					title: "Build",
				},
			],
		});
	});

	it("is available at capacity one and unavailable only for stale or non-line owners", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		const singleSlotRuntime = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === "runtime:workshop" && item.item.type === "producer"
					? {
							...item,
							item: {
								...item.item,
								maxQueueSize: 1,
							},
						}
					: item,
			),
		} satisfies RuntimeSchema.Type;
		expect(
			Effect.runSync(
				readItemDetailQueueFx({
					itemId: "runtime:workshop",
					runtime: singleSlotRuntime,
				}),
			),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			capacity: 1,
			active: [],
			request: [],
		});
		expect(
			Effect.runSync(
				readItemDetailQueueFx({
					itemId: "runtime:missing",
					runtime,
				}),
			),
		).toEqual({
			kind: "unavailable",
		});
		expect(
			Effect.runSync(
				readItemDetailQueueFx({
					itemId: "runtime:permit",
					runtime,
				}),
			),
		).toEqual({
			kind: "unavailable",
		});
	});
});
