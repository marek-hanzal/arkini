import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionUpgradeStartSchema = z
	.object({
		inputRefs: z.array(GameActionItemRefSchema),
		type: z.literal("upgrade.start"),
		upgradeId: IdSchema,
	})
	.strict();

export type GameActionUpgradeStartSchema = typeof GameActionUpgradeStartSchema;

export namespace GameActionUpgradeStartSchema {
	export type Type = z.infer<typeof GameActionUpgradeStartSchema>;
}
