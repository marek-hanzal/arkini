import { z } from "zod";

import { InputSchema } from "~/engine/action/schema/InputSchema";
import { RuleSchema } from "~/engine/action/schema/RuleSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/** An immediately activated item that transitions gameplay to one authored space. */
export const SpaceItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
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

export type SpaceItemSchema = typeof SpaceItemSchema;

export namespace SpaceItemSchema {
	export type Type = z.infer<SpaceItemSchema>;
}
