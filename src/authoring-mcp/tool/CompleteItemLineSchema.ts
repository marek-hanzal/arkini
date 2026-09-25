import { z } from "zod";
import { LineSchema } from "~/production-line/schema/LineSchema";

/** Complete authored line without the immutable UID assigned by the mutation. */
export const CompleteItemLineSchema = z
	.object(LineSchema.shape)
	.omit({
		uid: true,
	})
	.extend({
		default: LineSchema.shape.default.removeDefault(),
		show: LineSchema.shape.show.removeDefault(),
		enable: LineSchema.shape.enable.removeDefault(),
	})
	.strict()
	.meta({
		id: "CompleteItemLineSchema",
		description:
			"A complete production line authoring value without its immutable UID. The trigger and weight default to manual and 1.",
	});

export type CompleteItemLineSchema = typeof CompleteItemLineSchema;
export namespace CompleteItemLineSchema {
	export type Type = z.output<CompleteItemLineSchema>;
}
