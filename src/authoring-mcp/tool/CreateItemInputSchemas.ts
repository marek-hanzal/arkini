import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { AssetSchema } from "~/item-definition/schema/AssetSchema";
import { BlueprintSchema } from "~/item-definition/schema/BlueprintSchema";
import { ClockSchema } from "~/item-definition/schema/ClockSchema";
import { InventorySchema } from "~/item-definition/schema/InventorySchema";
import { CommonSchema } from "~/item-definition/schema/CommonSchema";
import { TemporarySchema } from "~/item-definition/schema/TemporarySchema";
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
	clock: "urn:arkini:schema:mcp:create-clock-item-input",
	blueprint: "urn:arkini:schema:mcp:create-blueprint-item-input",
	temporary: "urn:arkini:schema:mcp:create-temporary-item-input",
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
			id: createItemInputSchemaIds.common,
			$id: createItemInputSchemaIds.common,
			title: "Create common item tool input",
			description: "Authoring fields accepted when creating one common item.",
		}),
	clock: ClockSchema.omit({
		asset: true,
		lines: true,
		intervalMs: true,
		enable: true,
		rules: true,
		control: true,
		maxQueueSize: true,
		maxStackSize: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
			maxQueueSize: draftMaxQueueSize,
			lines: ClockSchema.shape.lines.optional(),
			intervalMs: ClockSchema.shape.intervalMs
				.optional()
				.describe("Pulse interval in whole milliseconds; defaults to 1000."),
			enable: ClockSchema.shape.enable.removeDefault().optional(),
			rules: ClockSchema.shape.rules.removeDefault().optional(),
			control: ClockSchema.shape.control.removeDefault().optional(),
		})
		.strict()
		.meta({
			id: createItemInputSchemaIds.clock,
			$id: createItemInputSchemaIds.clock,
			title: "Create clock item tool input",
			description: "Authoring fields accepted when creating one clock item.",
		}),

	blueprint: BlueprintSchema.omit({
		asset: true,
		line: true,
		maxStackSize: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
			scope: draftScope,
			maxStackSize: draftMaxStackSize,
			line: BlueprintSchema.shape.line
				.optional()
				.describe(
					"Optional product line; defaults to the Editor's initial blueprint line.",
				),
		})
		.strict()
		.meta({
			id: createItemInputSchemaIds.blueprint,
			$id: createItemInputSchemaIds.blueprint,
			title: "Create blueprint item tool input",
			description: "Authoring fields accepted when creating one blueprint item.",
		}),
	temporary: TemporarySchema.omit({
		asset: true,
		durationMs: true,
		maxStackSize: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
			durationMs: TimeSchema.min(500)
				.optional()
				.describe("Optional lifetime in milliseconds; defaults to 500."),
		})
		.strict()
		.meta({
			id: createItemInputSchemaIds.temporary,
			$id: createItemInputSchemaIds.temporary,
			title: "Create temporary item tool input",
			description: "Authoring fields accepted when creating one temporary item.",
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
