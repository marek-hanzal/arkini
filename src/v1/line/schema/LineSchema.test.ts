import { describe, expect, it } from "vitest";

import { LineSchema } from "./LineSchema";

describe("LineSchema", () => {
	it("requires stable identity and player-facing metadata", () => {
		const line = {
			id: "line:wood",
			title: "Gather wood",
			description: "Turns a tree into wood.",
			runtimeMs: 1_000,
			input: [
				{
					type: "materials",
					itemId: "tree",
					quantity: {
						type: "value",
						value: 1,
					},
					capacity: 3,
				},
			],
			output: {
				set: [
					{
						roll: [
							{
								type: "guaranteed",
								drop: [
									{
										itemId: "wood",
										quantity: {
											type: "value",
											value: 1,
										},
										rules: [],
									},
								],
							},
						],
					},
				],
			},
			rules: [],
		};

		expect(LineSchema.safeParse(line).success).toBe(true);
		const lineWithDefaultCapacity = LineSchema.parse({
			...line,
			input: [
				{
					...line.input[0],
					capacity: undefined,
				},
			],
		});
		const [materialInput] = lineWithDefaultCapacity.input;
		if (materialInput?.type !== "materials") {
			throw new Error("Expected a material input.");
		}
		expect(materialInput.capacity).toBe(0);
		expect(materialInput.mode).toBe("consume");
		expect(
			LineSchema.safeParse({
				...line,
				input: [
					{
						...line.input[0],
						mode: "reserve",
					},
				],
			}).success,
		).toBe(true);
		expect(
			LineSchema.safeParse({
				...line,
				input: [
					{
						...line.input[0],
						mode: "borrow",
					},
				],
			}).success,
		).toBe(false);
		expect(
			LineSchema.safeParse({
				...line,
				input: [
					{
						...line.input[0],
						capacity: -1,
					},
				],
			}).success,
		).toBe(false);
		expect(
			LineSchema.safeParse({
				...line,
				output: undefined,
			}).success,
		).toBe(true);
		expect(
			LineSchema.safeParse({
				...line,
				input: [
					{
						...line.input[0],
						capacity: 0,
					},
				],
			}).success,
		).toBe(true);
		expect(
			LineSchema.safeParse({
				...line,
				title: "",
			}).success,
		).toBe(false);
	});
});
