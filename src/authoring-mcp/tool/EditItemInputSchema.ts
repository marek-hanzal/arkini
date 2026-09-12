import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";

const itemPatch = z
	.object(ItemSchema.shape)
	.omit({
		id: true,
		uid: true,
	})
	.partial()
	.extend({
		units: ItemSchema.shape.units.nullable(),
		description: ItemSchema.shape.description.nullable(),
		maxCount: ItemSchema.shape.maxCount.nullable(),
		merge: ItemSchema.shape.merge.nullable(),
		action: ItemSchema.shape.action.nullable(),
		clock: ItemSchema.shape.clock.nullable(),
		control: ItemSchema.shape.control,
		lines: ItemSchema.shape.lines.removeDefault().optional(),
		maxQueueSize: ItemSchema.shape.maxQueueSize.removeDefault().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Patch must replace at least one field.")
	.meta({
		id: "ItemPatchSchema",
		minProperties: 1,
		description: "Top-level replacements accepted for an existing item.",
	});

/** Strict replace patches; omitted fields stay unchanged and null clears optional fields. */
export const EditItemInputSchema = z
	.object({
		itemId: IdSchema.describe("The immutable item ID returned by item_collection."),
		revision: z
			.number()
			.int()
			.nonnegative()
			.optional()
			.describe(
				"Optional project revision returned by item_config. Supply it when replacing structured fields so a stale read is rejected instead of overwriting newer authoring changes.",
			),
		patch: itemPatch.describe(
			"Top-level replacements. Omitted fields remain unchanged; null clears an optional field.",
		),
	})
	.strict()
	.meta({
		id: "urn:arkini:schema:mcp:edit-item-input",
		$id: "urn:arkini:schema:mcp:edit-item-input",
		title: "Edit item tool input",
		description: "Identity, revision, and replacement patch for one item.",
	});
export type EditItemInputSchema = typeof EditItemInputSchema;
export namespace EditItemInputSchema {
	export type Type = z.output<EditItemInputSchema>;
}
