import { describe, expect, it } from "vitest";

import { StartSchema } from "~/v1/start/schema/StartSchema";

describe("StartSchema", () => {
	it("requires one explicit current space while defaulting both item collections", () => {
		expect(
			StartSchema.parse({
				currentSpace: 0,
			}),
		).toEqual({
			currentSpace: 0,
			board: [],
			inventory: [],
		});
		expect(StartSchema.safeParse({}).success).toBe(false);
	});

	it("requires non-negative board coordinates and positive inventory quantities", () => {
		expect(
			StartSchema.safeParse({
				currentSpace: 0,
				board: [
					{
						itemId: "item:tree",
						x: 0,
						y: 0,
					},
				],
			}).success,
		).toBe(false);
		expect(
			StartSchema.safeParse({
				currentSpace: 0,
				board: [
					{
						space: 0,
						itemId: "item:tree",
						x: -1,
						y: 0,
					},
				],
			}).success,
		).toBe(false);
		expect(
			StartSchema.safeParse({
				currentSpace: 0,
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
