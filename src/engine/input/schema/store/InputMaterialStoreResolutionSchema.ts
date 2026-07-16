import { z } from "zod";

import { InputMaterialStorePlanSchema } from "./InputMaterialStorePlanSchema";

/**
 * Optional store plan for one delivered item.
 *
 * `undefined` means that the item does not match this slot or that the slot has
 * no remaining capacity.
 */
export const InputMaterialStoreResolutionSchema = InputMaterialStorePlanSchema.optional().meta({
	id: "InputMaterialStoreResolutionSchema",
	description: "One material store plan, or undefined when this slot cannot accept the item.",
});

export type InputMaterialStoreResolutionSchema = typeof InputMaterialStoreResolutionSchema;

export namespace InputMaterialStoreResolutionSchema {
	export type Type = z.infer<InputMaterialStoreResolutionSchema>;
}
