import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import { InputMaterialSchema } from "~/engine/input/schema/InputMaterialSchema";

const fixedInput = InputMaterialSchema.parse({
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

describe("resolveInputMaterialFx", () => {
	it("reports a missing fixed input and its remaining buffer capacity", () => {
		expect(
			Effect.runSync(
				resolveInputMaterialFx({
					input: fixedInput,
					storedQuantity: 1,
				}),
			),
		).toEqual({
			type: "materials",
			mode: "consume",
			required: {
				min: 3,
				max: 3,
			},
			storedQuantity: 1,
			maxStoredQuantity: 5,
			runQuantity: 0,
			missingQuantity: 2,
			availableCapacity: 4,
			ready: false,
		});
	});

	it("caps one ready run at the required maximum and leaves buffered excess", () => {
		expect(
			Effect.runSync(
				resolveInputMaterialFx({
					input: fixedInput,
					storedQuantity: 4,
				}),
			),
		).toMatchObject({
			storedQuantity: 4,
			runQuantity: 3,
			missingQuantity: 0,
			availableCapacity: 1,
			ready: true,
		});
	});

	it("uses the stored quantity inside one accepted range", () => {
		const input = InputMaterialSchema.parse({
			type: "materials",
			selector: {
				type: "tag",
				tag: "fuel",
			},
			mode: "reserve",
			quantity: {
				type: "range",
				min: 2,
				max: 5,
			},
		});

		expect(
			Effect.runSync(
				resolveInputMaterialFx({
					input,
					storedQuantity: 4,
				}),
			),
		).toMatchObject({
			mode: "reserve",
			required: {
				min: 2,
				max: 5,
			},
			maxStoredQuantity: 5,
			runQuantity: 4,
			ready: true,
		});
	});
});
