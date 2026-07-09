import { z } from "zod";

/**
 * A generic runtime identifier.
 *
 * IDs are authored in source JSON. Their domain and cross-reference validity
 * belong to the complete game configuration rather than this scalar schema.
 */
export const IdSchema = z.string().min(1).describe("A non-empty runtime identifier.");

export namespace IdSchema {
	export type Type = z.infer<typeof IdSchema>;
}

export type ItemId = IdSchema.Type;
