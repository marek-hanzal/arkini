import { z } from "zod";
import { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";
import { ActionSchema } from "~/item-action/schema/ActionSchema";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An ordinary item with optional production, Clock scheduling, or one immediate action.
 */
export const CommonSchema = z
	.object({
		...BaseSchema.shape,
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
		 * Identifies an ordinary item with optional production.
		 */
		type: TypeSchema.extract([
			"Common",
		]),
		/**
		 * Zero or more product lines provided by this item.
		 */
		lines: z
			.array(LineSchema)
			.default([])
			.describe("Optional production lines; an item without lines or an action is passive."),
	})
	.strict()
	.meta({
		id: "item.CommonSchema",
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

export type CommonSchema = typeof CommonSchema;

export namespace CommonSchema {
	export type Type = z.infer<CommonSchema>;
}
