import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { planInputMaterialStoreFx } from "~/v1/input/fx/planInputMaterialStoreFx";
import { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import { runtimeInputTestItem } from "~test/input/fx/support/inputTestItems";

const input = InputMaterialSchema.parse({
	type: "materials",
	selector: {
		type: "item",
		itemId: "item:water",
	},
	quantity: {
		type: "value",
		value: 3,
	},
	capacity: 2,
});

describe("planInputMaterialStoreFx", () => {
	it("accepts only the remaining capacity from one matching stack", () => {
		expect(
			Effect.runSync(
				planInputMaterialStoreFx({
					input,
					item: runtimeInputTestItem({
						id: "runtime:water",
						itemId: "water",
						quantity: 4,
					}),
					storedQuantity: 3,
				}),
			),
		).toEqual({
			sourceItemId: "runtime:water",
			quantity: 2,
		});
	});

	it("returns undefined for a selector mismatch", () => {
		expect(
			Effect.runSync(
				planInputMaterialStoreFx({
					input,
					item: runtimeInputTestItem({
						id: "runtime:log",
						itemId: "log",
						quantity: 4,
					}),
					storedQuantity: 0,
				}),
			),
		).toBeUndefined();
	});

	it("returns undefined when the input buffer is already full", () => {
		expect(
			Effect.runSync(
				planInputMaterialStoreFx({
					input,
					item: runtimeInputTestItem({
						id: "runtime:water",
						itemId: "water",
						quantity: 1,
					}),
					storedQuantity: 5,
				}),
			),
		).toBeUndefined();
	});

	it("accepts tag-selected materials", () => {
		const taggedInput = InputMaterialSchema.parse({
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

		expect(
			Effect.runSync(
				planInputMaterialStoreFx({
					input: taggedInput,
					item: runtimeInputTestItem({
						id: "runtime:water",
						itemId: "water",
						quantity: 2,
					}),
					storedQuantity: 0,
				}),
			),
		).toEqual({
			sourceItemId: "runtime:water",
			quantity: 1,
		});
	});
});
