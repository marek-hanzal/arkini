import { z } from "zod";

/**
 * Fields shared by every output roll configuration.
 *
 * No common roll field is defined yet. Specialized roll schemas still spread
 * `BaseSchema.shape` so future shared fields are inherited consistently.
 */
export const BaseSchema = z.object({}).strict().meta({
	id: "roll.BaseSchema",
	description: "The common fields shared by every output roll.",
});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
