import { Data } from "effect";

import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

/** Verified Arkpack trust did not match the exact official identity required by its caller. */
export class ArkpackTrustMismatchError extends Data.TaggedError("ArkpackTrustMismatchError")<{
	readonly expectedKeyId: string;
	readonly actualTrust: ArkpackTrustSchema.Type;
	readonly message: string;
}> {}
