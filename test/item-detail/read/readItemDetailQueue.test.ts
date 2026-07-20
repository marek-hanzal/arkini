import { describe, expect, it } from "vitest";

import { readItemDetailQueue } from "~/engine/item-detail/read/readItemDetailQueue";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

describe("readItemDetailQueue", () => {
	it("projects only queued intents while preserving active work separately", () => {
		const base = lineRunRuntime({});
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
			readItemDetailQueue({
				itemId: "runtime:workshop",
				runtime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			capacity: 2,
			activeCount: 1,
			request: [
				{
					requestId: "job:queued",
					lineId: "line:workshop:build",
					title: "Build",
				},
			],
		});
	});

	it("is unavailable for stale and non-queue owners", () => {
		const runtime = lineRunRuntime({});
		expect(
			readItemDetailQueue({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
});
