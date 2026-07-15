import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import type { InputMaterialStoreResolutionSchema } from "~/v1/input/schema/store/InputMaterialStoreResolutionSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { isItemMaterialInputEligible } from "~/v1/input/read/isItemMaterialInputEligible";
import { selectorFx } from "~/v1/selector/fx/selectorFx";
import { resolveInputMaterialFx } from "./resolveInputMaterialFx";

export namespace planInputMaterialStoreFx {
	export interface Props {
		input: InputMaterialSchema.Type;
		item: RuntimeItemSchema.Type;
		requestedQuantity: PositiveIntegerSchema.Type;
		storedQuantity: NonNegativeIntegerSchema.Type;
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
	const matches = yield* selectorFx({
		item: item.item,
		selector: input.selector,
	});
	if (!matches || !isItemMaterialInputEligible(item.item)) {
		return undefined;
	}

	const resolution = yield* resolveInputMaterialFx({
		input,
		storedQuantity,
	});
	if (resolution.availableCapacity === 0) {
		return undefined;
	}

	return {
		sourceItemId: item.id,
		quantity: Math.min(item.quantity, requestedQuantity, resolution.availableCapacity),
	} satisfies InputMaterialStoreResolutionSchema.Type;
});
