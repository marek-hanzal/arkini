import { z } from "zod";

/**
 * A generic non-empty configuration identifier.
 *
 * Its domain and cross-reference validity are enforced by the configuration
 * schemas that consume it, not by this scalar schema.
 */
export const IdSchema = z.string().min(1).describe("A non-empty configuration identifier.");

export type IdSchema = typeof IdSchema;

export namespace IdSchema {
	export type Type = z.infer<IdSchema>;
}
