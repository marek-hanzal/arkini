import { Effect } from "effect";

import { ArkpackTrustMismatchError } from "~/bridge/arkpack/ArkpackTrustMismatchError";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

export namespace assertExpectedArkpackTrustFx {
	export interface Props {
		/** Official key identity required by a caller that loads trusted bundled content. */
		readonly expectedKeyId?: string;
		readonly trust: ArkpackTrustSchema.Type;
	}
}

/** Fails unless trust matches the exact official key required by the caller. */
export const assertExpectedArkpackTrustFx = Effect.fn("assertExpectedArkpackTrustFx")(function* ({
	expectedKeyId,
	trust,
}: assertExpectedArkpackTrustFx.Props) {
	if (expectedKeyId === undefined) return;
	if (trust.type === "official" && trust.keyId === expectedKeyId) return;
	return yield* Effect.fail(
		new ArkpackTrustMismatchError({
			expectedKeyId,
			actualTrust: trust,
			message: `Arkpack expected official signature ${expectedKeyId}, received ${trust.type}.`,
		}),
	);
});
