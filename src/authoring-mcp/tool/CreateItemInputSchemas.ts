import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { AssetSchema } from "~/item-definition/schema/AssetSchema";
import { InventorySchema } from "~/item-definition/schema/InventorySchema";
import { CommonSchema } from "~/item-definition/schema/CommonSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

const draftAsset = AssetSchema.optional().describe(
	"Optional visual asset definition; defaults to the first asset in the open project.",
);
const draftScope = StorageSchema.optional().describe(
	"Optional storage scope; defaults to any, matching a new Editor form.",
);
const draftMaxStackSize = PositiveIntegerSchema.optional().describe(
	"Optional maximum stack size; defaults to one.",
);
const draftMaxQueueSize = PositiveIntegerSchema.optional().describe(
	"Optional accepted job count, including the active job and queued requests; defaults to one.",
);

const createItemInputSchemaIds = {
	common: "urn:arkini:schema:mcp:create-common-item-input",
	inventory: "urn:arkini:schema:mcp:create-inventory-item-input",
} as const;

/** Human-facing create inputs; omitted fields use the matching Editor form's draft values. */
export const CreateItemInputSchemas = {
	common: CommonSchema.omit({
		asset: true,
		lines: true,
		maxQueueSize: true,
		maxStackSize: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
			scope: draftScope,
			maxStackSize: draftMaxStackSize,
			maxQueueSize: draftMaxQueueSize,
			lines: CommonSchema.shape.lines
				.removeDefault()
				.optional()
				.describe(
					"Optional production lines; omitted or empty lines create a passive item.",
				),
		})
		.strict()
		.meta({
			not: CommonSchema.meta()?.not,
			if: CommonSchema.meta()?.if,
			then: CommonSchema.meta()?.then,
			id: createItemInputSchemaIds.common,
			$id: createItemInputSchemaIds.common,
			title: "Create common item tool input",
			description: "Authoring fields accepted when creating one common item.",
		}),
	inventory: InventorySchema.omit({
		asset: true,
		maxCount: true,
		maxStackSize: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
		})
		.strict()
		.meta({
			id: createItemInputSchemaIds.inventory,
			$id: createItemInputSchemaIds.inventory,
			title: "Create inventory item tool input",
			description: "Authoring fields accepted when creating one inventory item.",
		}),
} as const;

export type CreateItemInput = z.output<
	(typeof CreateItemInputSchemas)[keyof typeof CreateItemInputSchemas]
>;
