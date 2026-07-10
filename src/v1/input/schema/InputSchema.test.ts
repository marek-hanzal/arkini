import { describe, expect, it } from "vitest";

import { InputSchema } from "./InputSchema";

describe("InputSchema", () => {
	it("parses material requirements with their standard defaults", () => {
		const input = InputSchema.parse({
			type: "materials",
			selector: {
				type: "tag",
				tag: "liquid",
			},
			quantity: {
				type: "value",
				value: 1,
			},
		});

		expect(input).toMatchObject({
			capacity: 0,
			mode: "consume",
			type: "materials",
		});
	});

	it("parses board deposit requirements independently from material inputs", () => {
		expect(
			InputSchema.safeParse({
				type: "deposit",
				query: {
					scope: "board",
					distance: "near",
					selector: {
						type: "tag",
						tag: "wood-source",
					},
				},
				quantity: {
					type: "value",
					value: 1,
				},
			}).success,
		).toBe(true);
	});

	it("requires an explicit input discriminator", () => {
		expect(
			InputSchema.safeParse({
				selector: {
					type: "item",
					itemId: "item:water",
				},
				quantity: {
					type: "value",
					value: 1,
				},
			}).success,
		).toBe(false);
	});
});
