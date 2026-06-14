import { z } from "zod";

export const BuyUpgradeInputSchema = z.object({
	upgradeId: z.string().startsWith("upgrade:"),
});
