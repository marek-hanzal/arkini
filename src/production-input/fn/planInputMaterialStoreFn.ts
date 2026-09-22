import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";

export namespace planInputMaterialStoreFn {
	export interface Props {
		input: MaterialSchema.Type;
		item: RuntimeItemSchema.Type;
		storedQuantity: NonNegativeIntegerSchema.Type;
	}

	export interface Plan {
		readonly sourceItemId: RuntimeItemSchema.Type["id"];
	}
}

/**
 * Admits one delivered identity when the material slot matches and has capacity.
 */
export const planInputMaterialStoreFn = ({
	input,
	item,
	storedQuantity,
}: planInputMaterialStoreFn.Props) => {
	const matches = selectItemsFn({
		items: [
			item.item,
		],
		selector: input.query.selector,
	});
	if (matches.length === 0) {
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
	} satisfies planInputMaterialStoreFn.Plan;
};
