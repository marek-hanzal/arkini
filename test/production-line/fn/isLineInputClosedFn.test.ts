import { describe, expect, it } from "vitest";

import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const activeRuntime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
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
	jobQueue: [],
	defaultLineByOwnerItemId: {},
} satisfies RuntimeSchema.Type;

describe("isLineInputClosedFn", () => {
	it("closes only a zero-capacity input owned by an active line job", () => {
		const resolve = (capacity: number, runtime: RuntimeSchema.Type = activeRuntime) =>
			isLineInputClosedFn({
				input: {
					capacity,
				},
				ownerItemId: "runtime:owner",
				lineId: "line:run",
				runtime,
			});

		expect(resolve(0)).toBe(true);
		expect(resolve(1)).toBe(false);
		expect(
			resolve(0, {
				...activeRuntime,
				jobs: [],
			}),
		).toBe(false);
	});
});
