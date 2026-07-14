import { describe, expect, it } from "vitest";

import { CraftItemSchema } from "~/v1/item/schema/CraftItemSchema";

const craft = {
	id: "item:craft",
	title: "Craft",
	description: "One craft item.",
	asset: {
		source: [
			"asset:craft",
		],
	},
	tags: [],
	categoryId: "resource",
	scope: "any",
	maxStackSize: 10,
	type: "craft",
	afterCompletion: "remove",
	line: {
		id: "line:craft",
		title: "Craft",
		description: "Run the craft.",
		runtimeMs: 1_000,
		input: [
			{
				type: "materials",
				selector: {
					type: "item",
					itemId: "material",
				},
				quantity: {
					type: "value",
					value: 1,
				},
			},
		],
		rules: [],
	},
} as const;

describe("CraftItemSchema", () => {
	it("defaults authored material capacity to zero", () => {
		const parsed = CraftItemSchema.parse(craft);
		const input = parsed.line.input[0];
		if (input.type !== "materials") {
			throw new Error("Expected one material input.");
		}

		expect(input.capacity).toBe(0);
	});

	it("accepts both zero and positive material capacity at the shared schema boundary", () => {
		expect(
			CraftItemSchema.safeParse({
				...craft,
				line: {
					...craft.line,
					input: [
						{
							...craft.line.input[0],
							capacity: 0,
						},
					],
				},
			}).success,
		).toBe(true);
		expect(
			CraftItemSchema.safeParse({
				...craft,
				line: {
					...craft.line,
					input: [
						{
							...craft.line.input[0],
							capacity: 1,
						},
					],
				},
			}).success,
		).toBe(true);
	});
});
