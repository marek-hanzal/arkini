import { z } from "zod";
import { GameUpgradeIdSchema } from "~/v0/manifest/GameUpgradeIdSchema";

export const BuyUpgradeInputSchema = z.object({
	upgradeId: GameUpgradeIdSchema,
});

type BuyUpgradeInputSchema = typeof BuyUpgradeInputSchema;
export namespace BuyUpgradeInputSchema {
	export type Type = z.infer<BuyUpgradeInputSchema>;
}
