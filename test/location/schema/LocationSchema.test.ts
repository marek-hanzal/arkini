import { describe, expect, it } from "vitest";

import { LocationSchema } from "~/v1/location/schema/LocationSchema";

describe("LocationSchema", () => {
	it("accepts concrete grid and line-input locations", () => {
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
	});
});
