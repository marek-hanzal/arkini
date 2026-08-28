import { z } from "zod";

/**
 * Discriminates the rules evaluated for a product line.
 */
export const TypeSchema = z
	.enum({
		Show: "show",
		Hide: "hide",
		Enable: "enable",
		Disable: "disable",
		RuntimeAdjust: "runtime:adjust",
		RuntimeMultiplier: "runtime:multiplier",
	})
	.meta({
		id: "line.rule.TypeSchema",
		description: "The kind of rule evaluated for a product line.",
	});

export type TypeSchema = typeof TypeSchema;

export namespace TypeSchema {
	export type Type = z.infer<TypeSchema>;
}
