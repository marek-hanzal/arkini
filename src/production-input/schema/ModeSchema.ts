import { z } from "zod";

/**
 * Discriminates how an input item participates in a product line.
 */
export const ModeSchema = z
	.enum({
		Consume: "consume",
		Reserve: "reserve",
	})
	.meta({
		id: "input.ModeSchema",
		description: "How an input item participates in a product line.",
	});

export type ModeSchema = typeof ModeSchema;

export namespace ModeSchema {
	export type Type = z.infer<ModeSchema>;
}
