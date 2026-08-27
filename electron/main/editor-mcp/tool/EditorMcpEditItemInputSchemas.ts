import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseItemSchema } from "~/engine/item/schema/BaseItemSchema";
import { BlueprintItemSchema } from "~/engine/item/schema/BlueprintItemSchema";
import { CraftItemSchema } from "~/engine/item/schema/CraftItemSchema";
import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";
import { InventoryItemSchema } from "~/engine/item/schema/InventoryItemSchema";
import { ProducerItemSchema } from "~/engine/item/schema/ProducerItemSchema";
import { SimpleItemSchema } from "~/engine/item/schema/SimpleItemSchema";
import { SpaceItemSchema } from "~/engine/item/schema/SpaceItemSchema";
import { StashItemSchema } from "~/engine/item/schema/StashItemSchema";
import { TemporaryItemSchema } from "~/engine/item/schema/TemporaryItemSchema";

const requireReplacement = <Schema extends z.ZodType<Record<string, unknown>>>(patch: Schema) =>
	patch.refine(
		(value) => Object.keys(value).length > 0,
		"Patch must replace at least one field.",
	);

const immutableItemFields = {
	id: true,
	type: true,
	uid: true,
} as const;
const nullableBaseItemFields = {
	charges: BaseItemSchema.shape.charges.nullable(),
	maxCount: BaseItemSchema.shape.maxCount.nullable(),
	merge: BaseItemSchema.shape.merge.nullable(),
} as const;

const simplePatch = requireReplacement(
	SimpleItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "EditorMcpSimpleItemPatchSchema",
	description: "Top-level replacements accepted for an existing simple item.",
});
const spacePatch = requireReplacement(
	SpaceItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "EditorMcpSpaceItemPatchSchema",
	description: "Top-level replacements accepted for an existing space item.",
});
const producerPatch = requireReplacement(
	ProducerItemSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			maxQueueSize: ProducerItemSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "EditorMcpProducerItemPatchSchema",
	description: "Top-level replacements accepted for an existing producer item.",
});
const craftPatch = requireReplacement(
	CraftItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "EditorMcpCraftItemPatchSchema",
	description: "Top-level replacements accepted for an existing craft item.",
});
const blueprintPatch = requireReplacement(
	BlueprintItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "EditorMcpBlueprintItemPatchSchema",
	description: "Top-level replacements accepted for an existing blueprint item.",
});
const depositPatch = requireReplacement(
	DepositItemSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			lines: DepositItemSchema.shape.lines.nullable(),
			maxQueueSize: DepositItemSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "EditorMcpDepositItemPatchSchema",
	description: "Top-level replacements accepted for an existing deposit item.",
});
const stashPatch = requireReplacement(
	StashItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "EditorMcpStashItemPatchSchema",
	description: "Top-level replacements accepted for an existing stash item.",
});
const temporaryPatch = requireReplacement(
	TemporaryItemSchema.omit({
		...immutableItemFields,
		maxStackSize: true,
		scope: true,
	})
		.partial()
		.extend({
			...nullableBaseItemFields,
			output: TemporaryItemSchema.shape.output.nullable(),
		})
		.strict(),
).meta({
	id: "EditorMcpTemporaryItemPatchSchema",
	description: "Top-level replacements accepted for an existing temporary item.",
});
const inventoryPatch = requireReplacement(
	InventoryItemSchema.omit({
		...immutableItemFields,
		maxCount: true,
		maxStackSize: true,
		scope: true,
	})
		.partial()
		.extend({
			charges: nullableBaseItemFields.charges,
			merge: nullableBaseItemFields.merge,
		})
		.strict(),
).meta({
	id: "EditorMcpInventoryItemPatchSchema",
	description: "Top-level replacements accepted for an existing inventory item.",
});

const editItemInput = <Schema extends z.ZodType<Record<string, unknown>>>(
	patch: Schema,
	identity: {
		readonly id: string;
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
			id: identity.id,
			$id: identity.schemaId,
			title: identity.title,
			description: identity.description,
		});

/** Type-owned replace patches; omitted fields remain untouched and null clears optional fields. */
export const EditorMcpEditItemInputSchemas = {
	simple: editItemInput(simplePatch, {
		id: "EditorMcpEditSimpleItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-simple-item-input",
		title: "Edit simple item tool input",
		description: "Identity, revision, and replacement patch for one simple item.",
	}),
	space: editItemInput(spacePatch, {
		id: "EditorMcpEditSpaceItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-space-item-input",
		title: "Edit space item tool input",
		description: "Identity, revision, and replacement patch for one space item.",
	}),
	producer: editItemInput(producerPatch, {
		id: "EditorMcpEditProducerItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-producer-item-input",
		title: "Edit producer item tool input",
		description: "Identity, revision, and replacement patch for one producer item.",
	}),
	craft: editItemInput(craftPatch, {
		id: "EditorMcpEditCraftItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-craft-item-input",
		title: "Edit craft item tool input",
		description: "Identity, revision, and replacement patch for one craft item.",
	}),
	blueprint: editItemInput(blueprintPatch, {
		id: "EditorMcpEditBlueprintItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-blueprint-item-input",
		title: "Edit blueprint item tool input",
		description: "Identity, revision, and replacement patch for one blueprint item.",
	}),
	deposit: editItemInput(depositPatch, {
		id: "EditorMcpEditDepositItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-deposit-item-input",
		title: "Edit deposit item tool input",
		description: "Identity, revision, and replacement patch for one deposit item.",
	}),
	stash: editItemInput(stashPatch, {
		id: "EditorMcpEditStashItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-stash-item-input",
		title: "Edit stash item tool input",
		description: "Identity, revision, and replacement patch for one stash item.",
	}),
	temporary: editItemInput(temporaryPatch, {
		id: "EditorMcpEditTemporaryItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-temporary-item-input",
		title: "Edit temporary item tool input",
		description: "Identity, revision, and replacement patch for one temporary item.",
	}),
	inventory: editItemInput(inventoryPatch, {
		id: "EditorMcpEditInventoryItemInputSchema",
		schemaId: "urn:arkini:schema:mcp:edit-inventory-item-input",
		title: "Edit inventory item tool input",
		description: "Identity, revision, and replacement patch for one inventory item.",
	}),
} as const;

export type EditorMcpEditItemInput = z.output<
	(typeof EditorMcpEditItemInputSchemas)[keyof typeof EditorMcpEditItemInputSchemas]
>;
