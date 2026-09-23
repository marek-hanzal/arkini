import { describe, expect, it } from "vitest";

import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import { runtimeInputTestItem } from "~test/production-input/support/inputTestItems";

const input = MaterialSchema.parse({
	type: "materials",
	query: {
		distance: "far" as const,
		selector: {
			type: "item",
			itemUid: "item:water",
		},
	},
	quantity: {
		min: 3,
		max: 3,
	},
});

describe("planInputMaterialStoreFn", () => {
	it("admits one matching identity into available capacity", () => {
		expect(
			planInputMaterialStoreFn({
				input,
				item: runtimeInputTestItem({
					id: "runtime:water",
					itemId: "water",
				}),
				storedQuantity: 1,
			}),
		).toEqual({
			sourceItemId: "runtime:water",
		});
	});

	it("returns undefined for a selector mismatch", () => {
		expect(
			planInputMaterialStoreFn({
				input,
				item: runtimeInputTestItem({
					id: "runtime:log",
					itemId: "log",
				}),
				storedQuantity: 0,
			}),
		).toBeUndefined();
	});

	it("returns undefined when the input is already full", () => {
		expect(
			planInputMaterialStoreFn({
				input,
				item: runtimeInputTestItem({
					id: "runtime:water",
					itemId: "water",
				}),
				storedQuantity: 3,
			}),
		).toBeUndefined();
	});
});
