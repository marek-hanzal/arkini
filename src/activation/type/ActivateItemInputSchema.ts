import { z } from "zod";
import { BoardItemIdSchema } from "~/play/schema/BoardItemIdSchema";
import { ActivationModeSchema } from "./ActivationModeSchema";

export const ActivateItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	activation: ActivationModeSchema.default("single"),
});

type ActivateItemInputSchema = typeof ActivateItemInputSchema;
export namespace ActivateItemInputSchema {
	export type Type = z.infer<ActivateItemInputSchema>;
}
