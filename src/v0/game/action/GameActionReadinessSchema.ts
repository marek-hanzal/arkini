import { z } from "zod";
import { GameActionReadyReadinessSchema } from "~/v0/game/action/GameActionReadyReadinessSchema";
import { GameActionRejectedReadinessSchema } from "~/v0/game/action/GameActionRejectedReadinessSchema";

export const GameActionReadinessSchema = z.discriminatedUnion("type", [
	GameActionReadyReadinessSchema,
	GameActionRejectedReadinessSchema,
]);

export type GameActionReadinessSchema = typeof GameActionReadinessSchema;

export namespace GameActionReadinessSchema {
	export type Type = z.infer<typeof GameActionReadinessSchema>;
}

export type GameActionReadiness = GameActionReadinessSchema.Type;
