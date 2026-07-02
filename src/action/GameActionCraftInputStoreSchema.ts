import { z } from "zod";
import { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionCraftInputStoreSchema = z
	.object({
		inputRef: GameActionItemRefSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("craft.input.store"),
	})
	.strict();

export type GameActionCraftInputStoreSchema = typeof GameActionCraftInputStoreSchema;

export namespace GameActionCraftInputStoreSchema {
	export type Type = z.infer<typeof GameActionCraftInputStoreSchema>;
}
