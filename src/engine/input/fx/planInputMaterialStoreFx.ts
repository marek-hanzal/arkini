import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { MaterialSchema } from "~/engine/input/schema/MaterialSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { readMaterialInputEligibilityFn } from "~/engine/input/read/fn/readMaterialInputEligibilityFn";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";
import { resolveInputMaterialFn } from "~/engine/input/fn/resolveInputMaterialFn";

export namespace planInputMaterialStoreFx {
	export interface Props {
		input: MaterialSchema.Type;
		item: RuntimeItemSchema.Type;
		requestedQuantity: PositiveIntegerSchema.Type;
		storedQuantity: NonNegativeIntegerSchema.Type;
	}

	export interface Plan {
		readonly sourceItemId: RuntimeItemSchema.Type["id"];
		readonly quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Plans how much of one delivered runtime item a material input slot can accept.
 */
export const planInputMaterialStoreFx = Effect.fn("planInputMaterialStoreFx")(function* ({
	input,
	item,
	requestedQuantity,
	storedQuantity,
}: planInputMaterialStoreFx.Props) {
	const matches = selectItemsFn({
		items: [
			item.item,
		],
		selector: input.selector,
	});
	const eligibility = readMaterialInputEligibilityFn({
		items: [
			item.item,
		],
	});
	if (matches.length === 0 || eligibility.eligibleItems.length === 0) {
		return undefined;
	}

	const resolution = resolveInputMaterialFn({
		input,
		storedQuantity,
	});
	if (resolution.availableCapacity === 0) {
		return undefined;
	}

	return {
		sourceItemId: item.id,
		quantity: Math.min(item.quantity, requestedQuantity, resolution.availableCapacity),
	} satisfies planInputMaterialStoreFx.Plan;
});
