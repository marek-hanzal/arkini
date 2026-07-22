import { Array, Effect } from "effect";

import type { InputMaterialResolutionSchema } from "~/engine/input/schema/resolution/InputMaterialResolutionSchema";
import type { InputMaterialRunPlanResolutionSchema } from "~/engine/input/schema/run/InputMaterialRunPlanResolutionSchema";
import type { InputChargeRunPlanSchema } from "~/engine/input/schema/run/InputChargeRunPlanSchema";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

export namespace planInputMaterialRunFx {
	export interface Props {
		items: InputRuntimeItemSchema.Type[];
		resolution: InputMaterialResolutionSchema.Type;
		charges?: InputChargeRunPlanSchema.Type;
	}
}

/**
 * Allocates one ready material run deterministically across buffered items.
 *
 * Buffered runtime order is preserved so the same runtime snapshot always
 * produces the same concrete allocation.
 */
export const planInputMaterialRunFx = Effect.fn("planInputMaterialRunFx")(function* ({
	items,
	resolution,
	charges,
}: planInputMaterialRunFx.Props) {
	if (!resolution.ready) {
		return undefined;
	}

	const [remainingQuantity, allocation] = Array.mapAccum(
		items,
		resolution.runQuantity,
		(remaining, item) => {
			const quantity = Math.min(remaining, item.quantity);

			return [
				remaining - quantity,
				quantity > 0
					? {
							itemId: item.id,
							quantity,
						}
					: undefined,
			] as const;
		},
	);
	const plannedItems = allocation.filter((item) => item !== undefined);
	const [firstItem, ...remainingItems] = plannedItems;
	if (remainingQuantity > 0 || firstItem === undefined) {
		return undefined;
	}

	return {
		type: InputEnumSchema.enum.Materials,
		mode: resolution.mode,
		quantity: resolution.runQuantity,
		charges,
		item: [
			firstItem,
			...remainingItems,
		],
	} satisfies InputMaterialRunPlanResolutionSchema.Type;
});
