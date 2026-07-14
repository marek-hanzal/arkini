import { z } from "zod";

import { InputMaterialSchema } from "./InputMaterialSchema";

/** A craft material input that cannot author extra buffered capacity. */
export const CraftInputMaterialSchema = InputMaterialSchema.extend({
	capacity: z
		.literal(0)
		.default(0)
		.describe("Craft material inputs cannot buffer quantity above their requirement."),
}).meta({
	id: "CraftInputMaterialSchema",
	description: "A craft material input with authoring capacity fixed to zero.",
});

export type CraftInputMaterialSchema = typeof CraftInputMaterialSchema;

export namespace CraftInputMaterialSchema {
	export type Type = z.infer<CraftInputMaterialSchema>;
}
