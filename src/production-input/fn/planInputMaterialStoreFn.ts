import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { readMaterialInputEligibilityFn } from "~/production-input/read/fn/readMaterialInputEligibilityFn";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";

export namespace planInputMaterialStoreFn {
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
export const planInputMaterialStoreFn = ({
	input,
	item,
	requestedQuantity,
	storedQuantity,
}: planInputMaterialStoreFn.Props) => {
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
	} satisfies planInputMaterialStoreFn.Plan;
};
