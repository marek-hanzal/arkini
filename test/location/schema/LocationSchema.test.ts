import { describe, expect, it } from "vitest";

import { LocationSchema } from "~/v1/location/schema/LocationSchema";

describe("LocationSchema", () => {
	it("accepts concrete grid, line-input, consumed-job, and reserved locations", () => {
		expect(
			LocationSchema.safeParse({
				scope: "board",
				position: {
					x: 2,
					y: 3,
				},
			}).success,
		).toBe(true);
		expect(
			LocationSchema.safeParse({
				scope: "input",
				ownerItemId: "runtime:owner",
				lineId: "line:owner:work",
				inputIndex: 0,
			}).success,
		).toBe(true);
		expect(
			LocationSchema.safeParse({
				scope: "job",
				jobId: "job:owner:work",
			}).success,
		).toBe(true);
		expect(
			LocationSchema.safeParse({
				scope: "reserved",
				jobId: "job:owner:work",
			}).success,
		).toBe(true);
	});

	it("rejects abstract or incomplete locations", () => {
		expect(
			LocationSchema.safeParse({
				scope: "any",
				position: {
					x: 2,
					y: 3,
				},
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: "input",
				ownerItemId: "runtime:owner",
				lineId: "line:owner:work",
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: "input",
				ownerItemId: "runtime:owner",
				lineId: "line:owner:work",
				inputIndex: 0,
				returnLocation: {
					scope: "board",
					position: {
						x: 1,
						y: 1,
					},
				},
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: "job",
				jobId: "job:owner:work",
				mode: "reserve",
			}).success,
		).toBe(false);
	});
});
