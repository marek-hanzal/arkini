import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads total live quantity of one canonical item from an immutable runtime snapshot. */
export const readPlannerRuntimeQuantity = (runtime: RuntimeSchema.Type, itemId: IdSchema.Type) =>
	runtime.items.reduce((total, item) => total + (item.item.id === itemId ? item.quantity : 0), 0);
