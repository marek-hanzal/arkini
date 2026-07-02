import { z } from "zod";
import { GameActionReadyReadinessSchema } from "~/action/GameActionReadyReadinessSchema";
import { GameActionRejectedReadinessSchema } from "~/action/GameActionRejectedReadinessSchema";

const GameActionReadinessSchema = z.discriminatedUnion("type", [
	GameActionReadyReadinessSchema,
	GameActionRejectedReadinessSchema,
]);

export type GameActionReadiness = z.infer<typeof GameActionReadinessSchema>;
