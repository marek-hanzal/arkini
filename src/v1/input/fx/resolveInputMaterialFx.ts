import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import type { InputMaterialResolutionSchema } from "~/v1/input/schema/resolution/InputMaterialResolutionSchema";
import { readQuantityBoundsFx } from "~/v1/quantity/fx/readQuantityBoundsFx";

export namespace resolveInputMaterialFx {
	export interface Props {
		input: InputMaterialSchema.Type;
		storedQuantity: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Resolves readiness and remaining storage capacity for one material input slot.
 */
export const resolveInputMaterialFx = Effect.fn("resolveInputMaterialFx")(function* ({
	input,
	storedQuantity,
}: resolveInputMaterialFx.Props) {
	const required = yield* readQuantityBoundsFx({
		quantity: input.quantity,
	});
	const ready = storedQuantity >= required.min;
	const maxStoredQuantity = required.max + input.capacity;

	return {
		type: input.type,
		mode: input.mode,
		required,
		storedQuantity,
		maxStoredQuantity,
		runQuantity: ready ? Math.min(storedQuantity, required.max) : 0,
		missingQuantity: Math.max(0, required.min - storedQuantity),
		availableCapacity: Math.max(0, maxStoredQuantity - storedQuantity),
		ready,
	} satisfies InputMaterialResolutionSchema.Type;
});
