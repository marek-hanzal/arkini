import { z } from "zod";
import { GameUpgradeIdSchema } from "~/v0/game/config/GameIdSchema";
import { UpgradeCostViewSchema } from "./UpgradeCostViewSchema";

export const UpgradeViewSchema = z.object({
	id: GameUpgradeIdSchema,
	code: z.string(),
	name: z.string(),
	description: z.string(),
	level: z.number().int().nonnegative(),
	maxLevel: z.number().int().nonnegative(),
	maxed: z.boolean(),
	inProgress: z.boolean(),
	canBuy: z.boolean(),
	startedAtMs: z.number().optional(),
	readyAtMs: z.number().optional(),
	progress: z.number().optional(),
	nextCost: z.array(UpgradeCostViewSchema),
	currentEffects: z.array(z.string()),
	nextEffects: z.array(z.string()),
});

type UpgradeViewSchema = typeof UpgradeViewSchema;
export namespace UpgradeViewSchema {
	export type Type = z.infer<UpgradeViewSchema>;
}

export type UpgradeView = UpgradeViewSchema.Type;
