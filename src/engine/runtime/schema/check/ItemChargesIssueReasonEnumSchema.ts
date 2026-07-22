import { z } from "zod";

/** Why one live item's persisted charge state is invalid. */
export const ItemChargesIssueReasonEnumSchema = z
	.enum({
		MissingConfig: "missing-config",
		ExceedsAmount: "exceeds-amount",
		FullState: "full-state",
		DepletedIdle: "depleted-idle",
	})
	.meta({
		id: "ItemChargesIssueReasonEnumSchema",
		description: "Why one live item's persisted charge state is invalid.",
	});

export type ItemChargesIssueReasonEnumSchema = typeof ItemChargesIssueReasonEnumSchema;

export namespace ItemChargesIssueReasonEnumSchema {
	export type Type = z.infer<ItemChargesIssueReasonEnumSchema>;
}
