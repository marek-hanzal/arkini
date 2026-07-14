import { z } from "zod";

import { LineSchema } from "~/v1/line/schema/LineSchema";
import { AfterCompletionEnumSchema } from "./AfterCompletionEnumSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A construction-blueprint authoring contract with one ordinary product line.
 *
 * The blueprint visual is authored explicitly through the standard item asset. Its
 * line may emit any configured output and every resolved drop keeps its authored
 * placement strategy. Completion behavior is not inferred from the blueprint type.
 */
export const BlueprintItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"blueprint",
		]),
		afterCompletion: AfterCompletionEnumSchema.describe(
			"What happens to this blueprint after its line completes.",
		),
		line: LineSchema.describe("The one product line owned by this blueprint."),
	})
	.strict()
	.meta({
		id: "BlueprintItemSchema",
		description: "A construction-blueprint configuration with one product line.",
	});

export type BlueprintItemSchema = typeof BlueprintItemSchema;

export namespace BlueprintItemSchema {
	export type Type = z.infer<BlueprintItemSchema>;
}
