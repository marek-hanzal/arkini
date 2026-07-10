import { z } from "zod";

/**
 * Discriminates the explicit merge interaction variants.
 */
export const ActionEnumSchema = z
	.enum([
		/**
		 * Keeps the matched receiving item unchanged while resolving this merge.
		 */
		"keep",
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
		description: "The action that defines a merge interaction variant.",
	});

export type ActionEnumSchema = typeof ActionEnumSchema;

export namespace ActionEnumSchema {
	export type Type = z.infer<ActionEnumSchema>;
}
