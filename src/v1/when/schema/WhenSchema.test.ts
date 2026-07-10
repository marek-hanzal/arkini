import { describe, expect, it } from "vitest";

import { WhenSchema } from "./WhenSchema";

describe("WhenSchema", () => {
	it("accepts a general query condition", () => {
		expect(
			WhenSchema.safeParse({
				type: "query",
				query: {
					scope: "any",
					selector: {
						type: "tag",
						tag: "food",
					},
				},
				count: 2,
			}).success,
		).toBe(true);
	});

	it("uses a general query for count conditions", () => {
		expect(
			WhenSchema.safeParse({
				type: "count",
				query: {
					scope: "inventory",
					selector: {
						type: "tag",
						tag: "food",
					},
				},
				count: 2,
			}).success,
		).toBe(true);
	});

	it("requires a board query for distance conditions", () => {
		expect(
			WhenSchema.safeParse({
				type: "distance",
				query: {
					scope: "board",
					distance: "near",
					selector: {
						type: "item",
						itemId: "item:pollution",
					},
				},
				count: 1,
			}).success,
		).toBe(true);
		expect(
			WhenSchema.safeParse({
				type: "distance",
				query: {
					scope: "inventory",
					selector: {
						type: "item",
						itemId: "item:pollution",
					},
				},
				count: 1,
			}).success,
		).toBe(false);
	});
});
