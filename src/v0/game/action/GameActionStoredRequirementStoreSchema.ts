import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionStoredRequirementStoreSchema = z
	.object({
		inputRef: GameActionItemRefSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("stored_requirement.store"),
	})
	.strict();

export type GameActionStoredRequirementStoreSchema = typeof GameActionStoredRequirementStoreSchema;

export namespace GameActionStoredRequirementStoreSchema {
	export type Type = z.infer<typeof GameActionStoredRequirementStoreSchema>;
}
