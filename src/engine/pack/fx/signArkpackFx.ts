import { Effect } from "effect";
import { sign } from "sigstore";

import { ArkpackSigningError } from "~/engine/pack/error/ArkpackSigningError";

export namespace signArkpackFx {
	export interface Props {
		readonly bytes: Uint8Array;
	}
}

/** Keyless-signs exact bytes through the ambient GitHub Actions OIDC identity. */
export const signArkpackFx = Effect.fn("signArkpackFx")(function* ({ bytes }: signArkpackFx.Props) {
	return yield* Effect.tryPromise({
		try: () => sign(Buffer.from(bytes)),
		catch: (cause) =>
			new ArkpackSigningError({
				reason: "release-signing",
				message: "GitHub release identity could not keyless-sign the Arkpack.",
				cause,
			}),
	});
});
