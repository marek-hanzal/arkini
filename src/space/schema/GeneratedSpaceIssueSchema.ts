import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

export const GeneratedSpaceIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"GeneratedSpace",
		]),
		itemId: IdSchema,
		space: NonNegativeIntegerSchema,
		reason: z.enum([
			"duplicate-owner",
			"authored-address",
			"missing-template",
		]),
	})
	.strict()
	.meta({
		id: "GeneratedSpaceIssueSchema",
	});
export type GeneratedSpaceIssueSchema = typeof GeneratedSpaceIssueSchema;
export namespace GeneratedSpaceIssueSchema {
	export type Type = z.infer<GeneratedSpaceIssueSchema>;
}
