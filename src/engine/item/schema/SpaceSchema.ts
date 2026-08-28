import { z } from "zod";

import { InputSchema } from "~/engine/action/schema/InputSchema";
import { RuleSchema } from "~/engine/action/schema/RuleSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

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
