import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameSaveUpgradeStateSchema = z
	.object({
		completedTiers: NonNegativeIntegerSchema,
	})
	.strict();

export type GameSaveUpgradeStateSchema = typeof GameSaveUpgradeStateSchema;

export namespace GameSaveUpgradeStateSchema {
	export type Type = z.infer<typeof GameSaveUpgradeStateSchema>;
}
