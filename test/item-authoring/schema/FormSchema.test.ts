import { describe, expect, it } from "vitest";

import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { FormSchema } from "~/item-authoring/schema/FormSchema";

describe("FormSchema", () => {
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
					default: [
						"base",
						"",
					],
					sources: [],
				},
			}),
		).not.toHaveProperty("description");
	});

	it("omits empty optional artwork slots from the canonical item", () => {
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
					default: [
						"base",
						"",
					],
					sources: [
						"",
						"progress",
						"",
					],
				},
			}).asset,
		).toEqual({
			default: [
				"base",
			],
			sources: [
				"progress",
			],
		});
	});
});
