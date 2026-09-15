import { describe, expect, it } from "vitest";

import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import { runtimeInputTestItem } from "~test/production-input/support/inputTestItems";

const input = MaterialSchema.parse({
	type: "materials",
	selector: {
		type: "item",
		itemId: "item:water",
	},
	quantity: {
		min: 3,
		max: 3,
	},
});

describe("planInputMaterialStoreFn", () => {
	it("accepts only the remaining capacity from one matching stack", () => {
		expect(
			planInputMaterialStoreFn({
				input,
				requestedQuantity: 10,
				item: runtimeInputTestItem({
					id: "runtime:water",
					itemId: "water",
					quantity: 4,
				}),
				storedQuantity: 1,
			}),
		).toEqual({
			sourceItemId: "runtime:water",
			quantity: 2,
		});
	});

	it("returns undefined for a selector mismatch", () => {
		expect(
			planInputMaterialStoreFn({
				input,
				requestedQuantity: 10,
				item: runtimeInputTestItem({
					id: "runtime:log",
					itemId: "log",
					quantity: 4,
				}),
				storedQuantity: 0,
			}),
		).toBeUndefined();
	});

	it("returns undefined when the input is already full", () => {
		expect(
			planInputMaterialStoreFn({
				input,
				requestedQuantity: 10,
				item: runtimeInputTestItem({
					id: "runtime:water",
					itemId: "water",
					quantity: 1,
				}),
				storedQuantity: 3,
			}),
		).toBeUndefined();
	});
});
