import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { DescriptionSchema } from "~/game-value/schema/DescriptionSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { AssetSchema } from "./AssetSchema";
import { UnitsSchema } from "./UnitsSchema";

import { z } from "zod";
import { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";
import { ActionSchema } from "~/item-action/schema/ActionSchema";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/**
 * An ordinary item with optional production, Clock scheduling, or one immediate action.
 */
export const ItemSchema = z
	.object({
		/**
		 * Stable low-level identity of this canonical game item.
		 *
		 * The editor generates this CUID2 exactly once. Renaming the human-readable
		 * `id` never changes this identity.
		 */
		uid: IdSchema.describe("The immutable CUID2 identity of this canonical game item."),
		/**
		 * Stable authoring ID of this canonical game item.
		 */
		id: IdSchema.describe("The stable authoring ID of this canonical game item."),
		/**
		 * Human-readable title of this item.
		 */
		title: TitleSchema.describe("The human-readable title of this item."),
		/**
		 * Lightweight Editor authoring status with no gameplay semantics.
		 *
		 * Older item files omit this field and remain equivalent to an explicitly
		 * completed item.
		 */
		draft: z
			.boolean()
			.optional()
			.describe(
				"Whether this item still needs authoring work in the Editor; omitted means false.",
			),
		/**
		 * Optional human-readable explanation of this item's purpose.
		 */
		description: DescriptionSchema.optional().describe(
			"The optional human-readable explanation of this item's purpose.",
		),
		/**
		 * Visual asset definition used to render this item.
		 */
		asset: AssetSchema.describe("The visual asset definition used to render this item."),
		/**
		 * Part of game state in which this item may be stored.
		 */
		scope: StorageSchema.describe("The part of game state in which this item may be stored."),
		/**
		 * Optional maximum number of this item allowed across the game state.
		 */
		maxCount: PositiveIntegerSchema.optional().describe(
			"The optional maximum number of this item allowed across the game state.",
		),
		/**
		 * Maximum number of this item that one stack can hold.
		 *
		 * Runtime keeps an item with mutable state, such as production progress, in an
		 * individual stack even when this configured limit is greater than one.
		 */
		maxStackSize: PositiveIntegerSchema.describe(
			"The maximum number of this item that one stack can hold before it has mutable state.",
		),
		/**
		 * Optional finite unit supply initialized separately for each fresh item instance.
		 */
		units: UnitsSchema.optional().describe(
			"The optional supply of units, such as health, resource stock, or uses, and depletion output of each item instance.",
		),
		/**
		 * Optional target-specific merges initiated when this item is dropped onto another item.
		 */
		merge: z
			.tuple(
				[
					MergeSchema,
				],
				MergeSchema,
			)
			.optional()
			.describe(
				"The optional non-empty target-specific merges initiated when this item is dropped onto another item.",
			),
		clock: ItemScheduleSchema.optional(),
		control: z
			.enum([
				"automatic-only",
				"interactive",
			])
			.optional()
			.describe("Player production control; omission means interactive."),
		action: ActionSchema.optional().describe(
			"An optional immediate action; mutually exclusive with production lines.",
		),
		/**
		 * Maximum accepted work count: one active job plus pending requests.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of accepted active and queued runs for this item; defaults to one.",
		),
		/**
		 * Zero or more product lines provided by this item.
		 */
		lines: z
			.array(LineSchema)
			.default([])
			.describe("Optional production lines; an item without lines or an action is passive."),
	})
	.strict()
	.superRefine((item, context) => {
		if (item.clock !== undefined) {
			for (const [field, valid, message] of [
				[
					"scope",
					item.scope === "board",
					"Clock requires Board storage.",
				],
				[
					"maxStackSize",
					item.maxStackSize === 1,
					"Clock items cannot stack.",
				],
				[
					"action",
					item.action === undefined,
					"An item cannot have both Clock and Action.",
				],
			] as const) {
				if (!valid)
					context.addIssue({
						code: "custom",
						path: [
							field,
						],
						message,
					});
			}
		}
		if (item.action !== undefined && item.lines.length > 0) {
			context.addIssue({
				code: "custom",
				path: [
					"action",
				],
				message: "An item cannot have both an action and production lines.",
			});
		}
	})
	.meta({
		id: "ItemSchema",
		// JSON Schema clients must enforce the same capability conflict as canonical Item validation.
		if: {
			required: [
				"clock",
			],
		},
		then: {
			required: [
				"scope",
			],
			properties: {
				scope: {
					const: "board",
				},
				maxStackSize: {
					const: 1,
				},
			},
			not: {
				required: [
					"action",
				],
			},
		},
		not: {
			required: [
				"action",
				"lines",
			],
			properties: {
				lines: {
					minItems: 1,
				},
			},
		},
		description:
			"An ordinary item with optional production, Clock scheduling, or one immediate action.",
	});

export type ItemSchema = typeof ItemSchema;

export namespace ItemSchema {
	export type Type = z.infer<ItemSchema>;
}
