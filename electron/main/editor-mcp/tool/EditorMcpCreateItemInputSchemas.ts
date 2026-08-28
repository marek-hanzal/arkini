import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { AssetSchema } from "~/engine/item/schema/AssetSchema";
import { BlueprintSchema } from "~/engine/item/schema/BlueprintSchema";
import { CraftSchema } from "~/engine/item/schema/CraftSchema";
import { DepositSchema } from "~/engine/item/schema/DepositSchema";
import { InventorySchema } from "~/engine/item/schema/InventorySchema";
import { ProducerSchema } from "~/engine/item/schema/ProducerSchema";
import { SimpleSchema } from "~/engine/item/schema/SimpleSchema";
import { SpaceSchema } from "~/engine/item/schema/SpaceSchema";
import { StashSchema } from "~/engine/item/schema/StashSchema";
import { TemporarySchema } from "~/engine/item/schema/TemporarySchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

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
	"Optional maximum parallel queue size; defaults to one.",
);

/** Human-facing create inputs; omitted fields use the matching Editor form's draft values. */
export const EditorMcpCreateItemInputSchemas = {
	simple: SimpleSchema.omit({
		asset: true,
		maxStackSize: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
			scope: draftScope,
			maxStackSize: draftMaxStackSize,
		})
		.strict()
		.meta({
			id: "EditorMcpCreateSimpleItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-simple-item-input",
			title: "Create simple item tool input",
			description: "Authoring fields accepted when creating one simple item.",
		}),
	space: SpaceSchema.omit({
		asset: true,
		enable: true,
		input: true,
		maxStackSize: true,
		rules: true,
		scope: true,
		type: true,
		uid: true,
	})
		.extend({
			asset: draftAsset,
			enable: SpaceSchema.shape.enable.removeDefault().optional(),
			input: SpaceSchema.shape.input.removeDefault().optional(),
			rules: SpaceSchema.shape.rules.removeDefault().optional(),
			scope: draftScope,
			maxStackSize: draftMaxStackSize,
		})
		.strict()
		.meta({
			id: "EditorMcpCreateSpaceItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-space-item-input",
			title: "Create space item tool input",
			description: "Authoring fields accepted when creating one space item.",
		}),
	producer: ProducerSchema.omit({
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
			lines: ProducerSchema.shape.lines
				.optional()
				.describe(
					"Optional non-empty product lines; defaults to the Editor's initial producer line.",
				),
		})
		.strict()
		.meta({
			id: "EditorMcpCreateProducerItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-producer-item-input",
			title: "Create producer item tool input",
			description: "Authoring fields accepted when creating one producer item.",
		}),
	craft: CraftSchema.omit({
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
			line: CraftSchema.shape.line
				.optional()
				.describe("Optional product line; defaults to the Editor's initial craft line."),
		})
		.strict()
		.meta({
			id: "EditorMcpCreateCraftItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-craft-item-input",
			title: "Create craft item tool input",
			description: "Authoring fields accepted when creating one craft item.",
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
			id: "EditorMcpCreateBlueprintItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-blueprint-item-input",
			title: "Create blueprint item tool input",
			description: "Authoring fields accepted when creating one blueprint item.",
		}),
	deposit: DepositSchema.omit({
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
			lines: DepositSchema.shape.lines.optional(),
		})
		.strict()
		.meta({
			id: "EditorMcpCreateDepositItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-deposit-item-input",
			title: "Create deposit item tool input",
			description: "Authoring fields accepted when creating one deposit item.",
		}),
	stash: StashSchema.omit({
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
			line: StashSchema.shape.line
				.optional()
				.describe("Optional product line; defaults to the Editor's initial stash line."),
		})
		.strict()
		.meta({
			id: "EditorMcpCreateStashItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-stash-item-input",
			title: "Create stash item tool input",
			description: "Authoring fields accepted when creating one stash item.",
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
			id: "EditorMcpCreateTemporaryItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-temporary-item-input",
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
			id: "EditorMcpCreateInventoryItemInputSchema",
			$id: "urn:arkini:schema:mcp:create-inventory-item-input",
			title: "Create inventory item tool input",
			description: "Authoring fields accepted when creating one inventory item.",
		}),
} as const;

export type EditorMcpCreateItemInput = z.output<
	(typeof EditorMcpCreateItemInputSchemas)[keyof typeof EditorMcpCreateItemInputSchemas]
>;
