import { describe, expect, it } from "vitest";

import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const activeRuntime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
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
	it("closes an input owned by an active line job", () => {
		const resolve = (runtime: RuntimeSchema.Type = activeRuntime) =>
			isLineInputClosedFn({
				ownerItemId: "runtime:owner",
				lineId: "line:run",
				runtime,
			});

		expect(resolve()).toBe(true);
		expect(
			resolve({
				...activeRuntime,
				jobs: [],
			}),
		).toBe(false);
	});
});
