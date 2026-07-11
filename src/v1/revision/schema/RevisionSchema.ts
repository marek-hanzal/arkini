import { z } from "zod";

/**
 * One opaque optimistic-concurrency token for a mutable runtime entity.
 */
export const RevisionSchema = z.string().min(1).meta({
	id: "RevisionSchema",
	description: "An opaque optimistic-concurrency token for a mutable runtime entity.",
});

export type RevisionSchema = typeof RevisionSchema;

export namespace RevisionSchema {
	export type Type = z.infer<RevisionSchema>;
}
