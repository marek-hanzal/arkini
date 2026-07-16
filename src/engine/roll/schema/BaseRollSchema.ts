import { z } from "zod";

/**
 * Fields shared by every output roll configuration.
 *
 * No common roll field is defined yet. Specialized roll schemas still spread
 * `BaseRollSchema.shape` so future shared fields are inherited consistently.
 */
export const BaseRollSchema = z.object({}).strict().meta({
	id: "BaseRollSchema",
	description: "The common fields shared by every output roll.",
});

export type BaseRollSchema = typeof BaseRollSchema;

export namespace BaseRollSchema {
	export type Type = z.infer<BaseRollSchema>;
}
