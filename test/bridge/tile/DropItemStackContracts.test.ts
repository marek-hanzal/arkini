import { describe, expect, it } from "vitest";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useDropItem } from "~/bridge/tile/useDropItem";
import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const targetLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};

describe("public tile stack contracts", () => {
	it("exposes Stack through both preview and committed bridge result types", () => {
		const preview = {
			kind: DropItemResultKindEnumSchema.enum.Stack,
		} satisfies useDropItemPreview.Result;
		const outcome = {
			kind: DropItemResultKindEnumSchema.enum.Stack,
			transferredQuantity: 2,
			source: {
				itemId: "runtime:source",
				canonicalItemId: "material",
				previousRevision: "revision:source:before",
				previousLocation: sourceLocation,
				previousQuantity: 5,
				current: {
					itemId: "runtime:source",
					canonicalItemId: "material",
					revision: "revision:source:after",
					location: sourceLocation,
					quantity: 3,
				},
			},
			target: {
				itemId: "runtime:target",
				canonicalItemId: "material",
				previousRevision: "revision:target:before",
				previousLocation: targetLocation,
				previousQuantity: 8,
				current: {
					itemId: "runtime:target",
					canonicalItemId: "material",
					revision: "revision:target:after",
					location: targetLocation,
					quantity: 10,
				},
			},
		} satisfies useDropItem.Result;

		expect(preview.kind).toBe("stack");
		expect(outcome).toMatchObject({
			kind: "stack",
			transferredQuantity: 2,
			source: {
				previousQuantity: 5,
				current: {
					quantity: 3,
				},
			},
			target: {
				previousQuantity: 8,
				current: {
					quantity: 10,
				},
			},
		});
	});
});
