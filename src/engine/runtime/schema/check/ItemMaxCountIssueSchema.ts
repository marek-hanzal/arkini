import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * Live quantity plus active worst-case job output exceeds one canonical maxCount.
 */
export const ItemMaxCountIssueSchema = z
	.object({
		itemId: IdSchema.describe("The canonical item whose committed capacity exceeds maxCount."),
		itemIds: z
			.array(IdSchema)
			.describe("The live item identities contributing to the committed quantity."),
		jobIds: z
			.array(IdSchema)
			.describe("The active jobs reserving future quantity of this canonical item."),
		liveQuantity: NonNegativeIntegerSchema.describe("The currently live canonical quantity."),
		reservedQuantity: NonNegativeIntegerSchema.describe(
			"The worst-case future quantity reserved by active jobs.",
		),
		maxCount: PositiveIntegerSchema.describe("The configured maximum committed quantity."),
		quantity: PositiveIntegerSchema.describe(
			"The excessive committed quantity including live and reserved amounts.",
		),
		type: RuntimeCheckIssueEnumSchema.extract(["ItemMaxCount"]),
	})
	.strict()
	.meta({
		id: "ItemMaxCountIssueSchema",
		description:
			"Live quantity plus active worst-case job output exceeds one canonical maxCount.",
	});

export type ItemMaxCountIssueSchema = typeof ItemMaxCountIssueSchema;

export namespace ItemMaxCountIssueSchema {
	export type Type = z.infer<ItemMaxCountIssueSchema>;
}
