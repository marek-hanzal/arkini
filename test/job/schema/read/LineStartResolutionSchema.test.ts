import { describe, expect, it } from "vitest";

import { LineStartResolutionSchema } from "~/v1/job/schema/read/LineStartResolutionSchema";

const run = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
	show: true,
	enable: true,
	runtimeMs: 1_000,
	input: [
		{
			resolution: {
				type: "simple" as const,
				ready: true as const,
			},
			plan: {
				type: "simple" as const,
			},
		},
	],
	ready: false,
};

describe("LineStartResolutionSchema", () => {
	it("parses declarative run and queue state", () => {
		expect(
			LineStartResolutionSchema.parse({
				ownerItemId: "runtime:forge",
				lineId: "line:forge:run",
				run,
				queue: {
					jobs: [],
					used: 0,
					capacity: 2,
					available: true,
				},
				ready: false,
			}),
		).toMatchObject({
			ready: false,
			queue: {
				capacity: 2,
			},
		});
	});
});
