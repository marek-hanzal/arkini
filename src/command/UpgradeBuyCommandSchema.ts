import { z } from "zod";
import { BuyUpgradeInputSchema } from "~/play/schema/BuyUpgradeInputSchema";

export const UpgradeBuyCommandSchema = BuyUpgradeInputSchema.extend({
	type: z.literal("upgrade.buy"),
});

type UpgradeBuyCommandSchema = typeof UpgradeBuyCommandSchema;
export namespace UpgradeBuyCommandSchema {
	export type Type = z.infer<UpgradeBuyCommandSchema>;
}
