import { z } from "zod";
import { ActivationModeSchema } from "~/activation/type/ActivationModeSchema";
import { BoardItemIdSchema } from "~/play/schema/BoardItemIdSchema";

export const ActivationActivateCommandSchema = z.object({
	type: z.literal("activation.activate"),
	boardItemId: BoardItemIdSchema,
	activation: ActivationModeSchema.optional(),
});

type ActivationActivateCommandSchema = typeof ActivationActivateCommandSchema;
export namespace ActivationActivateCommandSchema {
	export type Type = z.infer<ActivationActivateCommandSchema>;
}
