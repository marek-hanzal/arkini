import { z } from "zod";
import { UpgradeViewSchema } from "./UpgradeViewSchema";

export const UpgradeListViewSchema = z.object({
	upgrades: z.array(UpgradeViewSchema),
});

type UpgradeListViewSchema = typeof UpgradeListViewSchema;
export namespace UpgradeListViewSchema {
	export type Type = z.infer<UpgradeListViewSchema>;
}

export type UpgradeListView = UpgradeListViewSchema.Type;
