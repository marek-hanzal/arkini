import { z } from "zod";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { GameResourceIdSchema } from "./GameResourceIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

export const StartingStateDefinitionSchema = z.object({
	resources: z.array(
		z.object({
			resourceId: GameResourceIdSchema,
			quantity: NonNegativeIntegerSchema,
		}),
	),
	inventory: z.array(
		z.object({
			itemId: GameItemIdSchema,
			quantity: PositiveIntegerSchema,
		}),
	),
	board: z.array(
		z.object({
			itemId: GameItemIdSchema,
			x: NonNegativeIntegerSchema,
			y: NonNegativeIntegerSchema,
		}),
	),
});

type StartingStateDefinitionSchema = typeof StartingStateDefinitionSchema;
export namespace StartingStateDefinitionSchema {
	export type Type = z.infer<StartingStateDefinitionSchema>;
}
