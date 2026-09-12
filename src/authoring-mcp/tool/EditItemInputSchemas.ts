import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseSchema } from "~/item-definition/schema/BaseSchema";
import { BlueprintSchema } from "~/item-definition/schema/BlueprintSchema";
import { ClockSchema } from "~/item-definition/schema/ClockSchema";
import { CraftSchema } from "~/item-definition/schema/CraftSchema";
import { InventorySchema } from "~/item-definition/schema/InventorySchema";
import { ProducerSchema } from "~/item-definition/schema/ProducerSchema";
import { SimpleSchema } from "~/item-definition/schema/SimpleSchema";
import { SpaceSchema } from "~/space-action/schema/SpaceSchema";
import { StashSchema } from "~/item-definition/schema/StashSchema";
import { TemporarySchema } from "~/item-definition/schema/TemporarySchema";

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
	charges: BaseSchema.shape.charges.nullable(),
	description: BaseSchema.shape.description.nullable(),
	maxCount: BaseSchema.shape.maxCount.nullable(),
	merge: BaseSchema.shape.merge.nullable(),
} as const;

const editItemInputSchemaIds = {
	simple: "urn:arkini:schema:mcp:edit-simple-item-input",
	space: "urn:arkini:schema:mcp:edit-space-item-input",
	producer: "urn:arkini:schema:mcp:edit-producer-item-input",
	clock: "urn:arkini:schema:mcp:edit-clock-item-input",
	craft: "urn:arkini:schema:mcp:edit-craft-item-input",
	blueprint: "urn:arkini:schema:mcp:edit-blueprint-item-input",
	stash: "urn:arkini:schema:mcp:edit-stash-item-input",
	temporary: "urn:arkini:schema:mcp:edit-temporary-item-input",
	inventory: "urn:arkini:schema:mcp:edit-inventory-item-input",
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
const clockPatch = requireReplacementFn(
	ClockSchema.omit({
		...immutableItemFields,
		scope: true,
		maxStackSize: true,
	})
		.partial()
		.extend({
			...nullableBaseItemFields,
			durationMs: ClockSchema.shape.durationMs.nullable(),
			onExpire: ClockSchema.shape.onExpire.nullable(),
			maxQueueSize: ClockSchema.shape.maxQueueSize.removeDefault().optional(),
			enable: ClockSchema.shape.enable.removeDefault().optional(),
			rules: ClockSchema.shape.rules.removeDefault().optional(),
			control: ClockSchema.shape.control.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "ClockItemPatchSchema",
	description: "Top-level replacements accepted for an existing clock item.",
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
	simple: editItemInputFn(simplePatch, {
		schemaId: editItemInputSchemaIds.simple,
		title: "Edit simple item tool input",
		description: "Identity, revision, and replacement patch for one simple item.",
	}),
	space: editItemInputFn(spacePatch, {
		schemaId: editItemInputSchemaIds.space,
		title: "Edit space item tool input",
		description: "Identity, revision, and replacement patch for one space item.",
	}),
	producer: editItemInputFn(producerPatch, {
		schemaId: editItemInputSchemaIds.producer,
		title: "Edit producer item tool input",
		description: "Identity, revision, and replacement patch for one producer item.",
	}),
	clock: editItemInputFn(clockPatch, {
		schemaId: editItemInputSchemaIds.clock,
		title: "Edit clock item tool input",
		description: "Identity, revision, and replacement patch for one clock item.",
	}),
	craft: editItemInputFn(craftPatch, {
		schemaId: editItemInputSchemaIds.craft,
		title: "Edit craft item tool input",
		description: "Identity, revision, and replacement patch for one craft item.",
	}),
	blueprint: editItemInputFn(blueprintPatch, {
		schemaId: editItemInputSchemaIds.blueprint,
		title: "Edit blueprint item tool input",
		description: "Identity, revision, and replacement patch for one blueprint item.",
	}),
	stash: editItemInputFn(stashPatch, {
		schemaId: editItemInputSchemaIds.stash,
		title: "Edit stash item tool input",
		description: "Identity, revision, and replacement patch for one stash item.",
	}),
	temporary: editItemInputFn(temporaryPatch, {
		schemaId: editItemInputSchemaIds.temporary,
		title: "Edit temporary item tool input",
		description: "Identity, revision, and replacement patch for one temporary item.",
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
