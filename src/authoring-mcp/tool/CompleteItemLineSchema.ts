import { z } from "zod";
import { LineSchema } from "~/production-line/schema/LineSchema";

const CompleteLineBaseSchema = LineSchema.extend({
	default: LineSchema.shape.default.removeDefault(),
	show: LineSchema.shape.show.removeDefault(),
	enable: LineSchema.shape.enable.removeDefault(),
});

export const CompleteItemLineSchema = z
	.discriminatedUnion("clock", [
		// A disabled Clock retains its authored weight across complete read/replace calls.
		CompleteLineBaseSchema.extend({
			clock: z.literal(false).optional(),
		}),
		CompleteLineBaseSchema.extend({
			clock: z.literal(true),
			clockWeight: LineSchema.shape.clockWeight.removeDefault(),
		}),
	])
	.meta({
		id: "CompleteItemLineSchema",
		description:
			"A complete production line. Clock lines require an explicit clockWeight; non-Clock lines preserve an explicit weight or default to 1 when omitted. Other canonical base values must be supplied explicitly.",
	});

export type CompleteItemLineSchema = typeof CompleteItemLineSchema;
export namespace CompleteItemLineSchema {
	export type Type = z.output<CompleteItemLineSchema>;
}
