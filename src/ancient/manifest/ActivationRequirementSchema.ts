import { z } from "zod";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

export const ActivationRequirementSchema = z
	.array(
		z.object({
			itemId: GameItemIdSchema,
			quantity: PositiveIntegerSchema,
			capacity: PositiveIntegerSchema,
		}),
	)
	.optional();

type ActivationRequirementSchema = typeof ActivationRequirementSchema;
export namespace ActivationRequirementSchema {
	export type Type = z.infer<ActivationRequirementSchema>;
}
