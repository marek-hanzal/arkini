import { z } from "zod";

import { ActionInputSchema } from "~/engine/action/schema/ActionInputSchema";
import { ActionRuleSchema } from "~/engine/action/schema/ActionRuleSchema";
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
		input: z.array(ActionInputSchema).default([]),
		rules: z.array(ActionRuleSchema).default([]),
	})
	.strict()
	.meta({
		id: "SpaceItemSchema",
		description:
			"An item whose shared immediate action requirements settle atomically with navigation.",
	});

export type SpaceItemSchema = typeof SpaceItemSchema;

export namespace SpaceItemSchema {
	export type Type = z.infer<SpaceItemSchema>;
}
