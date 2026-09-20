import { z } from "zod";
import { CreateItemLineInputSchema } from "./CreateItemLineInputSchema";
import { ReplaceItemLineInputSchema } from "./ReplaceItemLineInputSchema";
import { DeleteItemLineInputSchema } from "./DeleteItemLineInputSchema";

const ItemLineMutationSchema = z
	.discriminatedUnion("operation", [
		CreateItemLineInputSchema.omit({
			revision: true,
		}).extend({
			operation: z.literal("create"),
		}),
		ReplaceItemLineInputSchema.omit({
			revision: true,
		}).extend({
			operation: z.literal("replace"),
		}),
		DeleteItemLineInputSchema.omit({
			revision: true,
		}).extend({
			operation: z.literal("delete"),
		}),
	])
	.meta({
		id: "ItemLineMutationSchema",
		description: "One exact line edit; each item/line pair may appear only once in a batch.",
	});

export const EditItemLinesInputSchema = z
	.object({
		revision: CreateItemLineInputSchema.shape.revision,
		operations: z.array(ItemLineMutationSchema).min(1).max(20),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:edit-item-lines-input",
		$id: "urn:serakki:schema:mcp:edit-item-lines-input",
		title: "Edit item lines tool input",
		description:
			"Up to 20 complete create, replace or delete operations across items, validated before one revision-guarded best-effort commit.",
	});
export type EditItemLinesInputSchema = typeof EditItemLinesInputSchema;
export namespace EditItemLinesInputSchema {
	export type Type = z.output<EditItemLinesInputSchema>;
}
