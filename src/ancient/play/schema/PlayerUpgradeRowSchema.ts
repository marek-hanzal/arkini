import { z } from "zod";
import { GameUpgradeIdSchema } from "~/manifest/GameUpgradeIdSchema";

export const PlayerUpgradeRowSchema = z.object({
	id: z.string().min(1),
	saveGameId: z.string().min(1),
	upgradeDefinitionId: GameUpgradeIdSchema,
	level: z.number().int().min(0),
	targetLevel: z.number().int().min(0).nullable(),
	startedAt: z.string().min(1).nullable(),
	readyAt: z.string().min(1).nullable(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

type PlayerUpgradeRowSchema = typeof PlayerUpgradeRowSchema;
export namespace PlayerUpgradeRowSchema {
	export type Type = z.infer<PlayerUpgradeRowSchema>;
}
