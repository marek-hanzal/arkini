import { z } from "zod";
import { CommonSchema } from "./CommonSchema";
import { TypeSchema } from "./TypeSchema";
import { StorageSchema } from "./StorageSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";

/** A non-stackable Board producer whose schedule enqueues its effective default line. */
export const ClockSchema = z
	.object({
		...CommonSchema.omit({
			action: true,
		}).shape,
		lines: CommonSchema.shape.lines
			.removeDefault()
			.min(1)
			.describe("One or more production lines available to the schedule."),
		...ItemScheduleSchema.shape,
		type: TypeSchema.extract([
			"Clock",
		]),
		scope: StorageSchema.extract([
			"Board",
		]).default(StorageSchema.enum.Board),
		maxStackSize: PositiveIntegerSchema.max(1).default(1),
		control: z
			.enum([
				"automatic-only",
				"interactive",
			])
			.default("automatic-only")
			.describe(
				"Whether the player can operate production controls in addition to automatic impulses.",
			),
	})
	.strict()
	.meta({
		id: "item.ClockSchema",
		description: "A scheduled producer with ordinary lines and optional active lifetime.",
	});
export type ClockSchema = typeof ClockSchema;
export namespace ClockSchema {
	export type Type = z.infer<ClockSchema>;
}
