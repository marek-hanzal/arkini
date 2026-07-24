import { Data } from "effect";

import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

/** The official signing workflow could not establish its requested trusted identity. */
export class ArkpackSigningError extends Data.TaggedError("ArkpackSigningError")<{
	readonly reason: "untrusted-key-id" | "post-sign-verification";
	readonly keyId: string;
	readonly actualTrust?: ArkpackTrustSchema.Type;
	readonly message: string;
}> {}
