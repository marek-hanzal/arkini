import { z } from "zod";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

const CompleteLineBaseSchema = z
	.object(LineSchema.shape)
	.omit({
		uid: true,
	})
	.extend({
		default: LineSchema.shape.default.removeDefault(),
		show: LineSchema.shape.show.removeDefault(),
		enable: LineSchema.shape.enable.removeDefault(),
	});

export const CompleteItemLineSchema = z
	.union([
		CompleteLineBaseSchema.omit({
			clock: true,
		}).strict(),
		CompleteLineBaseSchema.extend({
			clock: LineClockModeEnumSchema,
			clockWeight: LineSchema.shape.clockWeight.removeDefault(),
		}).strict(),
	])
	.meta({
		id: "CompleteItemLineSchema",
		description:
			"A complete production line authoring value without its immutable UID. Create generates a UID and replace retains the addressed UID. Clock lines require an explicit clockWeight; non-Clock lines preserve an explicit weight or default to 1 when omitted. Other canonical base values must be supplied explicitly.",
	});

export type CompleteItemLineSchema = typeof CompleteItemLineSchema;
export namespace CompleteItemLineSchema {
	export type Type = z.output<CompleteItemLineSchema>;
}
