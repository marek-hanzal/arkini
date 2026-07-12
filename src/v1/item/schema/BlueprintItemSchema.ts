import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { LineSchema } from "~/v1/line/schema/LineSchema";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A construction blueprint with explicit unfinished and completed visuals.
 *
 * The asset tuple is ordered as `[blueprintAssetId, targetAssetId]`. Both
 * resources are authored explicitly; neither is inferred from `targetId`.
 * The construction line owns timing and inputs, while `targetId` owns the
 * canonical replacement produced on completion. Optional `output` represents
 * additional rolled by-products such as trash or pollution.
 */
export const BlueprintItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"blueprint",
		]),
		asset: z
			.tuple([
				IdSchema,
				IdSchema,
			])
			.describe("The explicit [blueprint asset ID, completed target asset ID] tuple."),
		targetId: IdSchema.describe("The canonical item created when this blueprint completes."),
		line: LineSchema.omit({
			output: true,
		}).describe("The blueprint construction line without its canonical target output."),
		output: OutputSchema.optional().describe(
			"Optional additional output rolled when the blueprint completes.",
		),
	})
	.strict()
	.meta({
		id: "BlueprintItemSchema",
		description: "A construction blueprint with explicit visuals and target item.",
	});

export type BlueprintItemSchema = typeof BlueprintItemSchema;

export namespace BlueprintItemSchema {
	export type Type = z.infer<BlueprintItemSchema>;
}
