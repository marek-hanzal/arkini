import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

export const ItemLineOrderInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact ID of the item whose lines should be reordered."),
		lineUids: z
			.array(IdSchema)
			.describe(
				"Every existing line UID exactly once, in the requested order. Empty only when the item has no lines.",
			),
		revision: z
			.number()
			.int()
			.nonnegative()
			.describe("The exact project revision returned by item_json or items_json."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-line-order-input",
		title: "Item line order tool input",
		description:
			"Reorder an item's complete existing line list without changing any line values.",
	});
export type ItemLineOrderInputSchema = typeof ItemLineOrderInputSchema;
export namespace ItemLineOrderInputSchema {
	export type Type = z.output<ItemLineOrderInputSchema>;
}
