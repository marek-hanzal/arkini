import { Data } from "effect";

import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";

/** The official signing workflow could not establish its requested provenance. */
export class SerapackSigningError extends Data.TaggedError("SerapackSigningError")<{
	readonly reason: "release-signing" | "post-sign-verification";
	readonly actualProvenance?: SerapackProvenanceSchema.Type;
	readonly message: string;
	readonly cause?: unknown;
}> {}
