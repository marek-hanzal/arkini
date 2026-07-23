import { describe, expect, it } from "vitest";

import { StartSchema } from "~/engine/start/schema/StartSchema";

describe("StartSchema", () => {
	it("requires one explicit current space while defaulting all item collections", () => {
		expect(
			StartSchema.parse({
				currentSpace: 0,
			}),
		).toEqual({
			currentSpace: 0,
			board: [],
			inventory: [],
			toolbar: [],
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

	it("accepts only an exact non-negative toolbar position", () => {
		expect(
			StartSchema.parse({
				currentSpace: 0,
				toolbar: [
					{
						itemId: "item:inventory",
						position: {
							x: 12,
							y: 0,
						},
					},
				],
			}).toolbar,
		).toEqual([
			{
				itemId: "item:inventory",
				position: {
					x: 12,
					y: 0,
				},
			},
		]);
		expect(
			StartSchema.safeParse({
				currentSpace: 0,
				toolbar: [
					{
						itemId: "item:inventory",
						position: {
							x: -1,
							y: 0,
						},
					},
				],
			}).success,
		).toBe(false);
		expect(
			StartSchema.safeParse({
				currentSpace: 0,
				toolbar: [
					{
						itemId: "item:inventory",
						x: 0,
						y: 0,
					},
				],
			}).success,
		).toBe(false);
	});
});
