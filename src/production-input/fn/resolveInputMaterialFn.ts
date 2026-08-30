import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";

export namespace resolveInputMaterialFn {
	export interface Props {
		readonly input: MaterialSchema.Type;
		readonly storedQuantity: NonNegativeIntegerSchema.Type;
	}
}

/** Resolves readiness and remaining storage capacity for one material input slot. */
export const resolveInputMaterialFn = ({ input, storedQuantity }: resolveInputMaterialFn.Props) => {
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
};
