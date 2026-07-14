import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { isLineInputClosedFx } from "~/v1/line/fx/input/isLineInputClosedFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

const activeRuntime = {
	items: [],
	jobs: [
		{
			id: "job:active",
			ownerItemId: "runtime:owner",
			lineId: "line:run",
			durationMs: 1_000,
			remainingMs: 1_000,
		},
	],
} satisfies RuntimeSchema.Type;

describe("isLineInputClosedFx", () => {
	it("closes a zero-capacity input while its line owns an active job", () => {
		expect(
			Effect.runSync(
				isLineInputClosedFx({
					input: {
						capacity: 0,
					},
					ownerItemId: "runtime:owner",
					lineId: "line:run",
					runtime: activeRuntime,
				}),
			),
		).toBe(true);
	});

	it("keeps positive-capacity storage open while the line runs", () => {
		expect(
			Effect.runSync(
				isLineInputClosedFx({
					input: {
						capacity: 1,
					},
					ownerItemId: "runtime:owner",
					lineId: "line:run",
					runtime: activeRuntime,
				}),
			),
		).toBe(false);
	});

	it("keeps a zero-capacity input open while its line is idle", () => {
		expect(
			Effect.runSync(
				isLineInputClosedFx({
					input: {
						capacity: 0,
					},
					ownerItemId: "runtime:owner",
					lineId: "line:run",
					runtime: {
						items: [],
						jobs: [],
					},
				}),
			),
		).toBe(false);
	});
});
