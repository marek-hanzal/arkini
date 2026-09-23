import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

export const DeleteItemLineInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact ID of the item that owns the line."),
		revision: z
			.number()
			.int()
			.nonnegative()
			.describe("The exact project revision returned by the preceding config read."),
		lineId: IdSchema.describe("The exact existing line ID to delete."),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:delete-item-line-input",
		$id: "urn:serakki:schema:mcp:delete-item-line-input",
		title: "Delete item line tool input",
		description:
			"Remove exactly one existing production line; reject missing or ambiguous line IDs.",
	});
export type DeleteItemLineInputSchema = typeof DeleteItemLineInputSchema;
export namespace DeleteItemLineInputSchema {
	export type Type = z.output<DeleteItemLineInputSchema>;
}
