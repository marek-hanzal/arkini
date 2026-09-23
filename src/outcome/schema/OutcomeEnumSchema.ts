import { z } from "zod";

export const OutcomeEnumSchema = z
	.enum({
		Item: "item",
		Space: "space",
		Template: "template",
	})
	.meta({
		id: "OutcomeEnumSchema",
		description: "The kind of result emitted by a roll.",
	});
export type OutcomeEnumSchema = typeof OutcomeEnumSchema;
export namespace OutcomeEnumSchema {
	export type Type = z.infer<OutcomeEnumSchema>;
}
