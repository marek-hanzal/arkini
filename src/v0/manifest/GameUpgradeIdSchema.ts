import { z } from "zod";

export const GameUpgradeIdSchema = z.enum([
	"upgrade:lumber-camp-1-speed",
	"upgrade:quarry-1-speed",
	"upgrade:lumber-camp-1-loot",
	"upgrade:quarry-1-loot",
]);

type GameUpgradeIdSchema = typeof GameUpgradeIdSchema;
export namespace GameUpgradeIdSchema {
	export type Type = z.infer<GameUpgradeIdSchema>;
}
