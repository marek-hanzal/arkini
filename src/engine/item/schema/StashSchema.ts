import { z } from "zod";

import { LineSchema } from "~/production-line/schema/LineSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An item configuration that owns one ordinary product line.
 *
 * Output and placement use the shared line contract. Item lifetime is expressed independently through optional charges.
 */
export const StashSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
			"Stash",
		]),
		line: LineSchema.describe("The one product line owned by this stash."),
	})
	.strict()
	.meta({
		id: "item.StashSchema",
		description: "An item configuration with one product line.",
	});

export type StashSchema = typeof StashSchema;

export namespace StashSchema {
	export type Type = z.infer<StashSchema>;
}
