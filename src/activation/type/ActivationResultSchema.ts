import { z } from "zod";
import { ActivationDepletionSchema } from "./ActivationDepletionSchema";
import { ActivationPlacementSchema } from "./ActivationPlacementSchema";

export const ActivationResultSchema = z.object({
	activationBoardItemId: z.string().min(1),
	placements: z.array(ActivationPlacementSchema),
	depletion: ActivationDepletionSchema.optional(),
});

type ActivationResultSchema = typeof ActivationResultSchema;
export namespace ActivationResultSchema {
	export type Type = z.infer<ActivationResultSchema>;
}
