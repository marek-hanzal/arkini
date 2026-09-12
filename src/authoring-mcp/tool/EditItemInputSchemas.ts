import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseSchema } from "~/item-definition/schema/BaseSchema";
import { InventorySchema } from "~/item-definition/schema/InventorySchema";
import { CommonSchema } from "~/item-definition/schema/CommonSchema";

const requireReplacementFn = <Schema extends z.ZodType<Record<string, unknown>>>(patch: Schema) =>
	patch
		.refine((value) => Object.keys(value).length > 0, "Patch must replace at least one field.")
		.meta({
			minProperties: 1,
		});

const immutableItemFields = {
	id: true,
	type: true,
	uid: true,
} as const;
const nullableBaseItemFields = {
	units: BaseSchema.shape.units.nullable(),
	description: BaseSchema.shape.description.nullable(),
	maxCount: BaseSchema.shape.maxCount.nullable(),
	merge: BaseSchema.shape.merge.nullable(),
} as const;

const editItemInputSchemaIds = {
	common: "urn:arkini:schema:mcp:edit-common-item-input",
	inventory: "urn:arkini:schema:mcp:edit-inventory-item-input",
} as const;

const commonPatch = requireReplacementFn(
	CommonSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			action: CommonSchema.shape.action.nullable(),
			clock: CommonSchema.shape.clock.nullable(),
			control: CommonSchema.shape.control,
			lines: CommonSchema.shape.lines.removeDefault().optional(),
			maxQueueSize: CommonSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "CommonItemPatchSchema",
	description: "Top-level replacements accepted for an existing common item.",
});
const inventoryPatch = requireReplacementFn(
	InventorySchema.omit({
		...immutableItemFields,
		maxCount: true,
		maxStackSize: true,
		scope: true,
	})
		.partial()
		.extend({
			units: nullableBaseItemFields.units,
			description: nullableBaseItemFields.description,
			merge: nullableBaseItemFields.merge,
		})
		.strict(),
).meta({
	id: "InventoryItemPatchSchema",
	description: "Top-level replacements accepted for an existing inventory item.",
});

const editItemInputFn = <Schema extends z.ZodType<Record<string, unknown>>>(
	patch: Schema,
	identity: {
		readonly schemaId: string;
		readonly title: string;
		readonly description: string;
	},
) =>
	z
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
			patch: patch.describe(
				"Top-level replacements. Omitted fields remain unchanged; null clears an optional field.",
			),
		})
		.strict()
		.meta({
			id: identity.schemaId,
			$id: identity.schemaId,
			title: identity.title,
			description: identity.description,
		});

/** Type-owned replace patches; omitted fields remain untouched and null clears optional fields. */
export const EditItemInputSchemas = {
	common: editItemInputFn(commonPatch, {
		schemaId: editItemInputSchemaIds.common,
		title: "Edit common item tool input",
		description: "Identity, revision, and replacement patch for one common item.",
	}),
	inventory: editItemInputFn(inventoryPatch, {
		schemaId: editItemInputSchemaIds.inventory,
		title: "Edit inventory item tool input",
		description: "Identity, revision, and replacement patch for one inventory item.",
	}),
} as const;

export type EditItemInput = z.output<
	(typeof EditItemInputSchemas)[keyof typeof EditItemInputSchemas]
>;
