import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { LineSchema } from "~/v1/line/schema/LineSchema";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A construction-blueprint authoring contract with explicit unfinished and completed visuals.
 *
 * The asset tuple is ordered as `[blueprintAssetId, targetAssetId]`. Both
 * resources are authored explicitly; neither is inferred from `targetId`.
 * Multiple blueprints may intentionally reference the same blueprint visual;
 * explicit reference reuse is not an implicit naming convention.
 * The construction line owns authored timing and inputs, while `targetId` names the
 * intended replacement. Runtime target replacement remains a separate capability
 * and must not be inferred from schema support alone. Optional `output` describes
 * intended additional rolled by-products.
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
			.describe(
				"The explicit [blueprint asset ID, completed target asset ID] tuple; either resource may be shared by multiple items.",
			),
		targetId: IdSchema.describe("The intended target item for blueprint completion."),
		line: LineSchema.omit({
			output: true,
		}).describe("The blueprint construction line without its canonical target output."),
		output: OutputSchema.optional().describe(
			"Optional additional output intended for blueprint completion.",
		),
	})
	.strict()
	.meta({
		id: "BlueprintItemSchema",
		description:
			"A construction-blueprint configuration with explicit visuals and target item.",
	});

export type BlueprintItemSchema = typeof BlueprintItemSchema;

export namespace BlueprintItemSchema {
	export type Type = z.infer<BlueprintItemSchema>;
}
