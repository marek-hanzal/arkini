import { z } from "zod";

import { LineSchema } from "~/engine/line/schema/LineSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A construction-blueprint authoring contract with one ordinary product line.
 *
 * The blueprint visual is authored explicitly through the standard item asset. Its
 * line may emit any configured output and every resolved drop keeps its authored
 * placement strategy. Item lifetime is expressed independently through optional charges.
 */
export const BlueprintSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
			"Blueprint",
		]),
		line: LineSchema.describe("The one product line owned by this blueprint."),
	})
	.strict()
	.meta({
		id: "item.BlueprintSchema",
		description: "A construction-blueprint configuration with one product line.",
	});

export type BlueprintSchema = typeof BlueprintSchema;

export namespace BlueprintSchema {
	export type Type = z.infer<BlueprintSchema>;
}
