import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { AssetSchema } from "~/engine/item/schema/AssetSchema";
import { BlueprintItemSchema } from "~/engine/item/schema/BlueprintItemSchema";
import { CraftItemSchema } from "~/engine/item/schema/CraftItemSchema";
import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";
import { InventoryItemSchema } from "~/engine/item/schema/InventoryItemSchema";
import { ProducerItemSchema } from "~/engine/item/schema/ProducerItemSchema";
import { SimpleItemSchema } from "~/engine/item/schema/SimpleItemSchema";
import { StashItemSchema } from "~/engine/item/schema/StashItemSchema";
import { TemporaryItemSchema } from "~/engine/item/schema/TemporaryItemSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

const draftAsset = AssetSchema.optional().describe(
	"Optional visual asset definition; defaults to the first asset in the open project.",
);
const draftScope = StorageScopeEnumSchema.optional().describe(
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
	simple: SimpleItemSchema.omit({
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
		.strict(),
	producer: ProducerItemSchema.omit({
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
			lines: ProducerItemSchema.shape.lines
				.optional()
				.describe(
					"Optional non-empty product lines; defaults to the Editor's initial producer line.",
				),
		})
		.strict(),
	craft: CraftItemSchema.omit({
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
			line: CraftItemSchema.shape.line
				.optional()
				.describe("Optional product line; defaults to the Editor's initial craft line."),
		})
		.strict(),
	blueprint: BlueprintItemSchema.omit({
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
			line: BlueprintItemSchema.shape.line
				.optional()
				.describe(
					"Optional product line; defaults to the Editor's initial blueprint line.",
				),
		})
		.strict(),
	deposit: DepositItemSchema.omit({
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
			lines: DepositItemSchema.shape.lines.optional(),
		})
		.strict(),
	stash: StashItemSchema.omit({
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
			line: StashItemSchema.shape.line
				.optional()
				.describe("Optional product line; defaults to the Editor's initial stash line."),
		})
		.strict(),
	temporary: TemporaryItemSchema.omit({
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
		.strict(),
	inventory: InventoryItemSchema.omit({
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
		.strict(),
} as const;

export type EditorMcpCreateItemInput = z.output<
	(typeof EditorMcpCreateItemInputSchemas)[keyof typeof EditorMcpCreateItemInputSchemas]
>;
