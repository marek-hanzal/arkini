import { z } from "zod";
import { LineSchema } from "~/production-line/schema/LineSchema";

export const CompleteItemLineSchema = LineSchema.extend({
	default: LineSchema.shape.default.removeDefault(),
	clockWeight: LineSchema.shape.clockWeight.removeDefault(),
	show: LineSchema.shape.show.removeDefault(),
	enable: LineSchema.shape.enable.removeDefault(),
}).meta({
	id: "CompleteItemLineSchema",
	description: "A complete production line with every canonical base value supplied explicitly.",
});

export type CompleteItemLineSchema = typeof CompleteItemLineSchema;
export namespace CompleteItemLineSchema {
	export type Type = z.output<CompleteItemLineSchema>;
}
