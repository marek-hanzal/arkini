import { describe, expect, it } from "vitest";

import { TemporarySchema } from "~/engine/item/schema/TemporarySchema";

const item = {
	uid: "item:effect:minor-haste",
	id: "item:effect:minor-haste",
	type: "temporary",
	title: "Minor Haste",
	description: "Temporarily marks an active production-speed blessing.",
	asset: {
		default: [
			"asset:item:effect:minor-haste",
		],
	},
	durationMs: 300_000,
};

describe("TemporarySchema", () => {
	it("defaults temporary items to board-only singleton stacks", () => {
		expect(TemporarySchema.parse(item)).toMatchObject({
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
				TemporarySchema.safeParse({
					...item,
					...override,
				}).success,
			).toBe(false);
		}
	});

	it("accepts an optional expiry output", () => {
		expect(
			TemporarySchema.safeParse({
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
												min: 1,
												max: 1,
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
