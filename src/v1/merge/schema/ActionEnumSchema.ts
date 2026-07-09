import { z } from "zod";

/**
 * Discriminates what happens to a merge source after it changes its target.
 */
export const ActionEnumSchema = z
	.enum([
		/**
		 * Uses the source item, then returns it to its original position.
		 */
		"use",
		/**
		 * Consumes the source item after it changes its target.
		 */
		"consume",
	])
	.meta({
		id: "ActionEnumSchema",
		description: "The action applied to a merge source after it changes its target.",
	});

export type ActionEnumSchema = typeof ActionEnumSchema;

export namespace ActionEnumSchema {
	export type Type = z.infer<ActionEnumSchema>;
}
