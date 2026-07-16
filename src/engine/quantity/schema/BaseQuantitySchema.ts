import { z } from "zod";

/**
 * Fields shared by every drop quantity configuration.
 *
 * No common quantity field is defined yet. Specialized quantity schemas spread
 * `BaseQuantitySchema.shape` so future shared fields remain consistent.
 */
export const BaseQuantitySchema = z.object({}).strict().meta({
	id: "BaseQuantitySchema",
	description: "The common fields shared by every drop quantity.",
});

export type BaseQuantitySchema = typeof BaseQuantitySchema;

export namespace BaseQuantitySchema {
	export type Type = z.infer<BaseQuantitySchema>;
}
