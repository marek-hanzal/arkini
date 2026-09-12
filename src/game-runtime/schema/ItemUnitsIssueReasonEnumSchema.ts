import { z } from "zod";

/** Why one live item's persisted unit state is invalid. */
export const ItemUnitsIssueReasonEnumSchema = z
	.enum({
		MissingConfig: "missing-config",
		ExceedsAmount: "exceeds-amount",
		FullState: "full-state",
		DepletedIdle: "depleted-idle",
	})
	.meta({
		id: "ItemUnitsIssueReasonEnumSchema",
		description: "Why one live item's persisted unit state is invalid.",
	});

export type ItemUnitsIssueReasonEnumSchema = typeof ItemUnitsIssueReasonEnumSchema;

export namespace ItemUnitsIssueReasonEnumSchema {
	export type Type = z.infer<ItemUnitsIssueReasonEnumSchema>;
}
