import { z } from "zod";

/**
 * The single scalar contract for every exact identity in Arkini.
 *
 * Domain meaning belongs to the field name and its owning schema. Reference,
 * uniqueness and lifecycle rules are enforced by the relevant compiler or
 * runtime boundary, not by parallel domain-specific ID scalar schemas.
 */
export const IdSchema = z.string().min(1).meta({
	id: "IdSchema",
	description: "A non-empty exact identity used across Arkini.",
});

export type IdSchema = typeof IdSchema;

export namespace IdSchema {
	export type Type = z.infer<IdSchema>;
}
