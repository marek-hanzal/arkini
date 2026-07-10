import { describe, expect, it } from "vitest";

import { StartSchema } from "./StartSchema";

describe("StartSchema", () => {
	it("defaults both initial collections to empty arrays", () => {
		expect(StartSchema.parse({})).toEqual({
			board: [],
			inventory: [],
		});
	});

	it("requires non-negative board coordinates and positive inventory quantities", () => {
		expect(
			StartSchema.safeParse({
				board: [
					{
						itemId: "item:tree",
						x: -1,
						y: 0,
					},
				],
			}).success,
		).toBe(false);
		expect(
			StartSchema.safeParse({
				inventory: [
					{
						itemId: "item:log",
						quantity: 0,
					},
				],
			}).success,
		).toBe(false);
	});
});
