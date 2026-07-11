import { describe, expect, it } from "vitest";

import { LocationSchema } from "~/v1/location/schema/LocationSchema";

describe("LocationSchema", () => {
	it("accepts only concrete board or inventory positions", () => {
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
				scope: "any",
				position: {
					x: 2,
					y: 3,
				},
			}).success,
		).toBe(false);
	});
});
