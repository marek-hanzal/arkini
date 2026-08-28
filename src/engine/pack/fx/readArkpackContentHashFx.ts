import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";
import { decodeArkpackEnvelopeFx } from "./decodeArkpackEnvelopeFx";

/** Hashes only immutable gameplay bytes so proof nondeterminism cannot change save identity. */
export const readArkpackContentHashFx = Effect.fn("readArkpackContentHashFx")(function* (
	bytes: Uint8Array,
) {
	const { payload } = yield* decodeArkpackEnvelopeFx(bytes);
	return yield* Effect.tryPromise({
		try: async () =>
			Array.from(
				new Uint8Array(await crypto.subtle.digest("SHA-256", payload.slice().buffer)),
				(byte) => byte.toString(16).padStart(2, "0"),
			).join(""),
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "hash",
				cause,
			}),
	});
});
