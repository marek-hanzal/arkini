import { z } from "zod";

export const PlayerUpgradeRowSchema = z.object({
	id: z.string().min(1),
	saveGameId: z.string().min(1),
	upgradeDefinitionId: z.string().startsWith("upgrade:"),
	level: z.number().int().min(0),
	targetLevel: z.number().int().min(0).nullable(),
	startedAt: z.string().min(1).nullable(),
	readyAt: z.string().min(1).nullable(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});
