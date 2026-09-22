import { z } from "zod";
import { SpaceActionSchema } from "~/space-action/schema/SpaceActionSchema";

export const ActionSchema = SpaceActionSchema.meta({
	description: "Immediate travel to a board space.",
	id: "itemAction.ActionSchema",
});
export type ActionSchema = typeof ActionSchema;
export namespace ActionSchema {
	export type Type = z.infer<ActionSchema>;
}
