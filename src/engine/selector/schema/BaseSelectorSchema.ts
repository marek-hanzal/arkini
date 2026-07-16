import { z } from "zod";

/**
 * Fields shared by every item selector configuration.
 *
 * No common selector field is defined yet. Specialized selector schemas still
 * spread `BaseSelectorSchema.shape` so future shared fields remain consistent.
 */
export const BaseSelectorSchema = z.object({}).strict().meta({
	id: "BaseSelectorSchema",
	description: "The common fields shared by every item selector.",
});

export type BaseSelectorSchema = typeof BaseSelectorSchema;

export namespace BaseSelectorSchema {
	export type Type = z.infer<BaseSelectorSchema>;
}
