import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseItemSchema } from "~/engine/item/schema/BaseItemSchema";
import { BlueprintItemSchema } from "~/engine/item/schema/BlueprintItemSchema";
import { CraftItemSchema } from "~/engine/item/schema/CraftItemSchema";
import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";
import { InventoryItemSchema } from "~/engine/item/schema/InventoryItemSchema";
import { ProducerItemSchema } from "~/engine/item/schema/ProducerItemSchema";
import { SimpleItemSchema } from "~/engine/item/schema/SimpleItemSchema";
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
);
const producerPatch = requireReplacement(
	ProducerItemSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			maxQueueSize: ProducerItemSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
);
const craftPatch = requireReplacement(
	CraftItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
);
const blueprintPatch = requireReplacement(
	BlueprintItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
);
const depositPatch = requireReplacement(
	DepositItemSchema.omit(immutableItemFields)
		.partial()
		.extend({
			...nullableBaseItemFields,
			lines: DepositItemSchema.shape.lines.nullable(),
			maxQueueSize: DepositItemSchema.shape.maxQueueSize.removeDefault().optional(),
		})
		.strict(),
);
const stashPatch = requireReplacement(
	StashItemSchema.omit(immutableItemFields).partial().extend(nullableBaseItemFields).strict(),
);
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
);
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
);

const editItemInput = <Schema extends z.ZodType<Record<string, unknown>>>(patch: Schema) =>
	z
		.object({
			itemId: IdSchema.describe("The immutable item ID returned by item_collection."),
			patch: patch.describe(
				"Top-level replacements. Omitted fields remain unchanged; null clears an optional field.",
			),
		})
		.strict();

/** Type-owned replace patches; omitted fields remain untouched and null clears optional fields. */
export const EditorMcpEditItemInputSchemas = {
	simple: editItemInput(simplePatch),
	producer: editItemInput(producerPatch),
	craft: editItemInput(craftPatch),
	blueprint: editItemInput(blueprintPatch),
	deposit: editItemInput(depositPatch),
	stash: editItemInput(stashPatch),
	temporary: editItemInput(temporaryPatch),
	inventory: editItemInput(inventoryPatch),
} as const;

export type EditorMcpEditItemInput = z.output<
	(typeof EditorMcpEditItemInputSchemas)[keyof typeof EditorMcpEditItemInputSchemas]
>;
