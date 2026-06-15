import { z } from "zod";
import { ActivationOutputSchema } from "./ActivationOutputSchema";
import { GameLootTableIdSchema } from "./GameLootTableIdSchema";

export const LootTableDefinitionSchema = z.object({
	id: GameLootTableIdSchema,
	name: z.string().min(1),
	output: ActivationOutputSchema,
});

type LootTableDefinitionSchema = typeof LootTableDefinitionSchema;
export namespace LootTableDefinitionSchema {
	export type Type = z.infer<LootTableDefinitionSchema>;
}
