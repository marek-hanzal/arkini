import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { InputRun } from "~/engine/input/InputRun";
import type { MaterialSchema } from "~/engine/input/schema/MaterialSchema";

export namespace resolveInputMaterialFx {
	export interface Props {
		input: MaterialSchema.Type;
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
	const required = input.quantity;
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
	} satisfies InputRun.MaterialResolution;
});
