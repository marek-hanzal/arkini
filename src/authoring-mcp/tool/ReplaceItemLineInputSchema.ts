import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { CompleteItemLineSchema } from "./CompleteItemLineSchema";

/** Revision-pinned complete replacement of one existing item line. */
export const ReplaceItemLineInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact ID of the item that owns the line."),
		lineUid: IdSchema.describe("The exact existing line UID to replace."),
		revision: z
			.number()
			.int()
			.nonnegative()
			.describe("The exact project revision returned by item_line_json."),
		line: CompleteItemLineSchema.describe(
			"The complete replacement line. The addressed line UID is retained; omitted optional values are removed.",
		),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:replace-item-line-input",
		$id: "urn:serakki:schema:mcp:replace-item-line-input",
		title: "Replace item line tool input",
		description: "Item identity, line identity, revision, and complete replacement line.",
	});

export type ReplaceItemLineInputSchema = typeof ReplaceItemLineInputSchema;

export namespace ReplaceItemLineInputSchema {
	export type Type = z.output<ReplaceItemLineInputSchema>;
}
