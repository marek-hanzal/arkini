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
					itemId: "tree",
					quantity: {
						type: "value",
						value: 1,
					},
				},
			],
			capacity: 3,
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
		expect(
			LineSchema.safeParse({
				...line,
				capacity: undefined,
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
				capacity: 0,
			}).success,
		).toBe(false);
		expect(
			LineSchema.safeParse({
				...line,
				title: "",
			}).success,
		).toBe(false);
	});
});
