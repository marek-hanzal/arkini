import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";

const itemPatch = z
	.object(ItemSchema.shape)
	.omit({
		uid: true,
	})
	.partial()
	.extend({
		units: ItemSchema.shape.units.nullable(),
		description: ItemSchema.shape.description.nullable(),
		merge: ItemSchema.shape.merge.nullable(),
		clock: ItemSchema.shape.clock.nullable(),
		ui: ItemSchema.shape.ui.removeDefault().optional(),
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
		itemUid: IdSchema.describe("The immutable item UID returned by item_collection."),
		revision: z
			.number()
			.int()
			.nonnegative()
			.optional()
			.describe(
				"Optional project revision returned by item_json. Supply it when replacing structured fields so a stale read is rejected instead of overwriting newer authoring changes.",
			),
		patch: itemPatch.describe(
			"Top-level replacements. Omitted fields remain unchanged; null clears an optional field.",
		),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:edit-item-input",
		$id: "urn:serakki:schema:mcp:edit-item-input",
		title: "Edit item tool input",
		description: "Identity, revision, and replacement patch for one item.",
	});
export type EditItemInputSchema = typeof EditItemInputSchema;
export namespace EditItemInputSchema {
	export type Type = z.output<EditItemInputSchema>;
}
