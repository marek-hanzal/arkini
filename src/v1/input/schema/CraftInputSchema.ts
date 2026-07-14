import { z } from "zod";

import { CraftInputMaterialSchema } from "./CraftInputMaterialSchema";
import { InputDepositSchema } from "./InputDepositSchema";
import { InputSimpleSchema } from "./InputSimpleSchema";

/** One craft input requirement with material capacity fixed to zero. */
export const CraftInputSchema = z
	.discriminatedUnion("type", [
		InputSimpleSchema,
		CraftInputMaterialSchema,
		InputDepositSchema,
	])
	.meta({
		id: "CraftInputSchema",
		description:
			"A simple, zero-capacity material, or authored deposit input for one craft line.",
	});

export type CraftInputSchema = typeof CraftInputSchema;

export namespace CraftInputSchema {
	export type Type = z.infer<CraftInputSchema>;
}
