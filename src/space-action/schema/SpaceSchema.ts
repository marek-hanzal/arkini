import { z } from "zod";

import { BaseSchema } from "~/item-definition/schema/BaseSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { InputSchema } from "~/production-action/schema/InputSchema";
import { RuleSchema } from "~/production-action/schema/RuleSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

/** An immediately activated item that transitions gameplay to one authored space. */
export const SpaceSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
			"Space",
		]),
		space: NonNegativeIntegerSchema.describe(
			"The authored board space selected after successful activation.",
		),
		enable: z.boolean().default(true),
		input: z.array(InputSchema).default([]),
		rules: z.array(RuleSchema).default([]),
	})
	.strict()
	.meta({
		id: "item.SpaceSchema",
		description:
			"An item whose shared immediate action requirements settle atomically with navigation.",
	});

export type SpaceSchema = typeof SpaceSchema;

export namespace SpaceSchema {
	export type Type = z.infer<SpaceSchema>;
}
