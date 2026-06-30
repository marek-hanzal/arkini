import { z } from "zod";
import { GameActionReadyReadinessSchema } from "~/v0/game/action/GameActionReadyReadinessSchema";
import { GameActionRejectedReadinessSchema } from "~/v0/game/action/GameActionRejectedReadinessSchema";

const GameActionReadinessSchema = z.discriminatedUnion("type", [
	GameActionReadyReadinessSchema,
	GameActionRejectedReadinessSchema,
]);

export type GameActionReadiness = z.infer<typeof GameActionReadinessSchema>;
