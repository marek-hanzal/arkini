import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Player command policy; autonomous production never passes through this gate. */
export const canControlItemProductionFn = (item: ItemSchema.Type): boolean =>
	item.control !== "automatic-only";
