import { DescriptionSchema } from "~/game-value/schema/DescriptionSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { ArtworkSchema } from "./ArtworkSchema";
import { UnitsSchema } from "./UnitsSchema";

import { z } from "zod";
import { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/**
 * An ordinary item with optional production, Clock scheduling, or one immediate action.
 */
export const ItemSchema = z
	.object({
		/** Immutable identity used by every canonical item reference. */
		uid: IdSchema.describe("The immutable UID of this canonical game item."),
		/**
		 * Human-readable title of this item.
		 */
		title: TitleSchema.describe("The human-readable title of this item."),
		/**
		 * Optional human-readable explanation of this item's purpose.
		 */
		description: DescriptionSchema.optional().describe(
			"The optional human-readable explanation of this item's purpose.",
		),
		ui: z
			.enum([
				"simple",
				"default",
			])
			.default("simple")
			.describe(
				"Item interface and player production control: simple shows only information but allows Board clicks on the default line; default enables manual production and always shows all sections, even without production lines.",
			),
		music: IdSchema.optional().describe(
			"Music resource requested while this item detail is open; omission keeps the global playlist.",
		),
		/**
		 * Visual artwork definition used to render this item.
		 */
		artwork: ArtworkSchema.describe("The visual artwork definition used to render this item."),
		/**
		 * Optional finite unit supply initialized separately for each fresh item instance.
		 */
		units: UnitsSchema.optional().describe(
			"The optional supply of units, such as health, resource stock, or uses, and depletion outcome of each item instance.",
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
			.superRefine((merges, context) => {
				let hasSpace = false;
				for (const [index, merge] of merges.entries()) {
					if (merge.action !== "space") continue;
					if (hasSpace)
						context.addIssue({
							code: "custom",
							path: [
								index,
								"action",
							],
							message: "Only one Space interaction is allowed per item.",
						});
					hasSpace = true;
				}
			})
			.meta({
				contains: {
					type: "object",
					properties: {
						action: {
							const: "space",
						},
					},
					required: [
						"action",
					],
				},
				minContains: 0,
				maxContains: 1,
			})
			.optional()
			.describe(
				"Optional directional merges and at most one receiver-owned Space interaction.",
			),
		clock: ItemScheduleSchema.optional(),
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
			.describe("Optional production lines; an item without lines is passive."),
	})
	.strict()
	.meta({
		id: "ItemSchema",
		description: "An ordinary item with optional production and Clock scheduling.",
	});

export type ItemSchema = typeof ItemSchema;

export namespace ItemSchema {
	export type Type = z.infer<ItemSchema>;
}
