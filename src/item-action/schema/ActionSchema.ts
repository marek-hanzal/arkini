import { z } from "zod";
import { SpaceActionSchema } from "~/space-action/schema/SpaceActionSchema";

/** Each action kind owns its required parameters and shares immediate requirements. */
export const ActionSchema = z
	.discriminatedUnion("type", [
		SpaceActionSchema,
	])
	.meta({
		id: "itemAction.ActionSchema",
		description: "One immediate item action selected by its type discriminator.",
	});
export type ActionSchema = typeof ActionSchema;
export namespace ActionSchema {
	export type Type = z.infer<ActionSchema>;
}
