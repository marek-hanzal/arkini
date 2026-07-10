import { describe, expect, it } from "vitest";

import { TemporaryItemSchema } from "./TemporaryItemSchema";

const item = {
	id: "item:effect:minor-haste",
	type: "temporary",
	title: "Minor Haste",
	description: "Temporarily marks an active production-speed blessing.",
	asset: {
		source: [
			"asset:item:effect:minor-haste",
		],
	},
	tags: [
		"effect",
		"buff",
	],
	categoryId: "utility",
	durationMs: 300_000,
};

describe("TemporaryItemSchema", () => {
	it("defaults temporary items to board-only singleton stacks", () => {
		expect(TemporaryItemSchema.parse(item)).toMatchObject({
			maxStackSize: 1,
			scope: "board",
			type: "temporary",
		});
	});

	it("rejects inventory storage, stacking, and lifetimes below 500 ms", () => {
		for (const override of [
			{
				scope: "inventory",
			},
			{
				scope: "any",
			},
			{
				maxStackSize: 2,
			},
			{
				durationMs: 499,
			},
		]) {
			expect(
				TemporaryItemSchema.safeParse({
					...item,
					...override,
				}).success,
			).toBe(false);
		}
	});

	it("accepts an optional expiry output", () => {
		expect(
			TemporaryItemSchema.safeParse({
				...item,
				output: {
					set: [
						{
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:ash",
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
			}).success,
		).toBe(true);
	});
});
