import { z } from "zod";

/**
 * Fields shared by every product-line input requirement.
 *
 * The base is intentionally empty today. It keeps all input variants aligned
 * with the schema composition convention as shared input fields are added.
 */
export const BaseInputSchema = z.object({}).strict().meta({
	id: "BaseInputSchema",
	description: "The common fields shared by every product-line input requirement.",
});

export type BaseInputSchema = typeof BaseInputSchema;

export namespace BaseInputSchema {
	export type Type = z.infer<BaseInputSchema>;
}
