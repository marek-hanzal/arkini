import { describe, expect, it } from "vitest";

import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { FormSchema } from "~/item-authoring/schema/FormSchema";

describe("FormSchema", () => {
	it.each([
		0.24,
		1.01,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])("rejects an invalid authored scale %s at its form field", (scale) => {
		const item = createDraftFn({
			resourceId: "base",
			type: "simple",
			uid: "item-form-scale",
		});
		const result = FormSchema.safeParse({
			...item,
			description: "",
			title: "Item title",
			asset: {
				scale,
				default: [
					"base",
					"",
				],
			},
		});
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues).toEqual([
			expect.objectContaining({
				path: [
					"asset",
					"scale",
				],
			}),
		]);
	});

	it("omits a blank optional item description", () => {
		const item = createDraftFn({
			resourceId: "base",
			type: "simple",
			uid: "item-form-description",
		});

		expect(
			FormSchema.parse({
				...item,
				description: "   ",
				title: "Item title",
				asset: {
					scale: 0.8,
					default: [
						"base",
						"",
					],
				},
			}),
		).not.toHaveProperty("description");
	});

	it("preserves authored scale while omitting empty optional artwork slots", () => {
		const item = createDraftFn({
			resourceId: "base",
			type: "simple",
			uid: "item-form-artwork",
		});

		expect(
			FormSchema.parse({
				...item,
				description: "Item description",
				title: "Item title",
				asset: {
					scale: 0.65,
					default: [
						"base",
						"",
					],
				},
			}).asset,
		).toEqual({
			scale: 0.65,
			default: [
				"base",
			],
		});
	});
});
