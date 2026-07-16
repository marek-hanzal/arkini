import { z } from "zod";

/**
 * Discriminates what happens to a source item after it initiates a merge.
 */
export const ActionEnumSchema = z
	.enum([
		/**
		 * Uses one source quantity, then returns it through standard placement.
		 */
		"use",
		/**
		 * Consumes the source item after it changes its target.
		 */
		"consume",
	])
	.meta({
		id: "ActionEnumSchema",
		description: "The action applied to a source item after it initiates a merge.",
	});

export type ActionEnumSchema = typeof ActionEnumSchema;

export namespace ActionEnumSchema {
	export type Type = z.infer<ActionEnumSchema>;
}
