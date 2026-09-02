import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseSchema } from "~/item-definition/schema/BaseSchema";
import { BlueprintSchema } from "~/item-definition/schema/BlueprintSchema";
import { CraftSchema } from "~/item-definition/schema/CraftSchema";
import { DepositSchema } from "~/item-definition/schema/DepositSchema";
import { InventorySchema } from "~/item-definition/schema/InventorySchema";
import { ProducerSchema } from "~/item-definition/schema/ProducerSchema";
import { SimpleSchema } from "~/item-definition/schema/SimpleSchema";
import { SpaceSchema } from "~/space-action/schema/SpaceSchema";
import { StashSchema } from "~/item-definition/schema/StashSchema";
import { TemporarySchema } from "~/item-definition/schema/TemporarySchema";

const requireReplacementFn = <Schema extends z.ZodType<Record<string, unknown>>>(patch: Schema) =>
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
	charges: BaseSchema.shape.charges.nullable(),
	maxCount: BaseSchema.shape.maxCount.nullable(),
	merge: BaseSchema.shape.merge.nullable(),
} as const;

const simplePatch = requireReplacementFn(
	SimpleSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "SimpleItemPatchSchema",
	description: "Top-level replacements accepted for an existing simple item.",
});
const spacePatch = requireReplacementFn(
	SpaceSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "SpaceItemPatchSchema",
	description: "Top-level replacements accepted for an existing space item.",
});
const producerPatch = requireReplacementFn(
	ProducerSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			maxQueueSize: ProducerSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "ProducerItemPatchSchema",
	description: "Top-level replacements accepted for an existing producer item.",
});
const craftPatch = requireReplacementFn(
	CraftSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "CraftItemPatchSchema",
	description: "Top-level replacements accepted for an existing craft item.",
});
const blueprintPatch = requireReplacementFn(
	BlueprintSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "BlueprintItemPatchSchema",
	description: "Top-level replacements accepted for an existing blueprint item.",
});
const depositPatch = requireReplacementFn(
	DepositSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			lines: DepositSchema.shape.lines.nullable(),
			maxQueueSize: DepositSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "DepositItemPatchSchema",
	description: "Top-level replacements accepted for an existing deposit item.",
});
const stashPatch = requireReplacementFn(
	StashSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "StashItemPatchSchema",
	description: "Top-level replacements accepted for an existing stash item.",
});
const temporaryPatch = requireReplacementFn(
	TemporarySchema.omit({
		...immutableItemFields,
		maxStackSize: true,
		scope: true,
	})
		.partial()
		.extend({
			...nullableBaseItemFields,
			output: TemporarySchema.shape.output.nullable(),
		})
		.strict(),
).meta({
	id: "TemporaryItemPatchSchema",
	description: "Top-level replacements accepted for an existing temporary item.",
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
			charges: nullableBaseItemFields.charges,
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
			$id: identity.schemaId,
			title: identity.title,
			description: identity.description,
		});

/** Type-owned replace patches; omitted fields remain untouched and null clears optional fields. */
export const EditItemInputSchemas = {
	simple: editItemInputFn(simplePatch, {
		schemaId: "urn:arkini:schema:mcp:edit-simple-item-input",
		title: "Edit simple item tool input",
		description: "Identity, revision, and replacement patch for one simple item.",
	}),
	space: editItemInputFn(spacePatch, {
		schemaId: "urn:arkini:schema:mcp:edit-space-item-input",
		title: "Edit space item tool input",
		description: "Identity, revision, and replacement patch for one space item.",
	}),
	producer: editItemInputFn(producerPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-producer-item-input",
		title: "Edit producer item tool input",
		description: "Identity, revision, and replacement patch for one producer item.",
	}),
	craft: editItemInputFn(craftPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-craft-item-input",
		title: "Edit craft item tool input",
		description: "Identity, revision, and replacement patch for one craft item.",
	}),
	blueprint: editItemInputFn(blueprintPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-blueprint-item-input",
		title: "Edit blueprint item tool input",
		description: "Identity, revision, and replacement patch for one blueprint item.",
	}),
	deposit: editItemInputFn(depositPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-deposit-item-input",
		title: "Edit deposit item tool input",
		description: "Identity, revision, and replacement patch for one deposit item.",
	}),
	stash: editItemInputFn(stashPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-stash-item-input",
		title: "Edit stash item tool input",
		description: "Identity, revision, and replacement patch for one stash item.",
	}),
	temporary: editItemInputFn(temporaryPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-temporary-item-input",
		title: "Edit temporary item tool input",
		description: "Identity, revision, and replacement patch for one temporary item.",
	}),
	inventory: editItemInputFn(inventoryPatch, {
		schemaId: "urn:arkini:schema:mcp:edit-inventory-item-input",
		title: "Edit inventory item tool input",
		description: "Identity, revision, and replacement patch for one inventory item.",
	}),
} as const;

export type EditItemInput = z.output<
	(typeof EditItemInputSchemas)[keyof typeof EditItemInputSchemas]
>;
