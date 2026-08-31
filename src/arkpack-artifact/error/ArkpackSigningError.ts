import { Data } from "effect";

import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";

/** The official signing workflow could not establish its requested provenance. */
export class ArkpackSigningError extends Data.TaggedError("ArkpackSigningError")<{
	readonly reason: "release-signing" | "post-sign-verification";
	readonly actualProvenance?: ArkpackProvenanceSchema.Type;
	readonly message: string;
	readonly cause?: unknown;
}> {}
