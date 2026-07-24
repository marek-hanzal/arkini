import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";

/** Computes the lowercase SHA-256 identity of exact final Arkpack bytes. */
export const readArkpackContentHashFx = Effect.fn("readArkpackContentHashFx")((bytes: Uint8Array) =>
	Effect.tryPromise({
		try: async () =>
			Array.from(
				new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)),
				(byte) => byte.toString(16).padStart(2, "0"),
			).join(""),
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "hash",
				cause,
			}),
	}),
);
