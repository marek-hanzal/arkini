import { z } from "zod";
import { GameResourceIdSchema } from "./GameResourceIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";

export const ResourceDefinitionSchema = z.object({
	id: GameResourceIdSchema,
	code: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	symbol: z.string().min(1),
	sort: NonNegativeIntegerSchema,
});

type ResourceDefinitionSchema = typeof ResourceDefinitionSchema;
export namespace ResourceDefinitionSchema {
	export type Type = z.infer<ResourceDefinitionSchema>;
}
