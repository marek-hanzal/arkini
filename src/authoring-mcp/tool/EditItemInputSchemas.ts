import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseSchema } from "~/item-definition/schema/BaseSchema";
import { BlueprintSchema } from "~/item-definition/schema/BlueprintSchema";
import { ClockSchema } from "~/item-definition/schema/ClockSchema";
import { InventorySchema } from "~/item-definition/schema/InventorySchema";
import { CommonSchema } from "~/item-definition/schema/CommonSchema";
import { SpaceSchema } from "~/space-action/schema/SpaceSchema";
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
	units: BaseSchema.shape.units.nullable(),
	description: BaseSchema.shape.description.nullable(),
	maxCount: BaseSchema.shape.maxCount.nullable(),
	merge: BaseSchema.shape.merge.nullable(),
} as const;

const editItemInputSchemaIds = {
	space: "urn:arkini:schema:mcp:edit-space-item-input",
	common: "urn:arkini:schema:mcp:edit-common-item-input",
	clock: "urn:arkini:schema:mcp:edit-clock-item-input",
	blueprint: "urn:arkini:schema:mcp:edit-blueprint-item-input",
	temporary: "urn:arkini:schema:mcp:edit-temporary-item-input",
	inventory: "urn:arkini:schema:mcp:edit-inventory-item-input",
} as const;

const spacePatch = requireReplacementFn(
	SpaceSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "SpaceItemPatchSchema",
	description: "Top-level replacements accepted for an existing space item.",
});
const commonPatch = requireReplacementFn(
	CommonSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			lines: CommonSchema.shape.lines.removeDefault().optional(),
			maxQueueSize: CommonSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
).meta({
	id: "CommonItemPatchSchema",
	description: "Top-level replacements accepted for an existing common item.",
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
const blueprintPatch = requireReplacementFn(
	BlueprintSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
).meta({
	id: "BlueprintItemPatchSchema",
	description: "Top-level replacements accepted for an existing blueprint item.",
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
	space: editItemInputFn(spacePatch, {
		schemaId: editItemInputSchemaIds.space,
		title: "Edit space item tool input",
		description: "Identity, revision, and replacement patch for one space item.",
	}),
	common: editItemInputFn(commonPatch, {
		schemaId: editItemInputSchemaIds.common,
		title: "Edit common item tool input",
		description: "Identity, revision, and replacement patch for one common item.",
	}),
	clock: editItemInputFn(clockPatch, {
		schemaId: editItemInputSchemaIds.clock,
		title: "Edit clock item tool input",
		description: "Identity, revision, and replacement patch for one clock item.",
	}),
	blueprint: editItemInputFn(blueprintPatch, {
		schemaId: editItemInputSchemaIds.blueprint,
		title: "Edit blueprint item tool input",
		description: "Identity, revision, and replacement patch for one blueprint item.",
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
