import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";
import type { ArkpackPublicKeySchema } from "~/engine/pack/schema/ArkpackPublicKeySchema";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";
import { createArkpackSigningPayloadFx } from "./createArkpackSigningPayloadFx";
import { readArkpackContentHashFx } from "./readArkpackContentHashFx";

export namespace verifyArkpackTrustFx {
	export interface Props {
		readonly bytes: Uint8Array;
		readonly publicKey: ArkpackPublicKeySchema.Type;
		readonly signature?: unknown;
	}

	export interface Result {
		readonly contentHash: string;
		readonly trust: ArkpackTrustSchema.Type;
	}
}

/** Classifies exact Arkpack bytes against optional detached metadata and one public key. */
export const verifyArkpackTrustFx = Effect.fn("verifyArkpackTrustFx")(function* ({
	bytes,
	publicKey,
	signature,
}: verifyArkpackTrustFx.Props) {
	const contentHash = yield* readArkpackContentHashFx(bytes);
	if (signature === undefined) {
		return {
			contentHash,
			trust: {
				type: "external",
				reason: "unsigned",
			},
		} satisfies verifyArkpackTrustFx.Result;
	}
	const parsed = ArkpackSignatureSchema.safeParse(signature);
	if (!parsed.success) {
		return {
			contentHash,
			trust: {
				type: "invalid",
				reason: "malformed-signature",
			},
		} satisfies verifyArkpackTrustFx.Result;
	}
	const importedKey = yield* Effect.tryPromise({
		try: async () => {
			const decoded = Uint8Array.from(atob(publicKey), (character) =>
				character.charCodeAt(0),
			);
			return await crypto.subtle.importKey(
				"spki",
				decoded,
				{
					name: "Ed25519",
				},
				false,
				[
					"verify",
				],
			);
		},
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "import-public-key",
				cause,
			}),
	});
	const payload = yield* createArkpackSigningPayloadFx(bytes);
	const signatureBytes = Uint8Array.from(atob(parsed.data), (character) =>
		character.charCodeAt(0),
	);
	const verified = yield* Effect.tryPromise({
		try: () =>
			crypto.subtle.verify(
				{
					name: "Ed25519",
				},
				importedKey,
				signatureBytes,
				payload,
			),
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "verify",
				cause,
			}),
	});

	return {
		contentHash,
		trust: verified
			? {
					type: "official",
				}
			: {
					type: "invalid",
					reason: "invalid-signature",
				},
	} satisfies verifyArkpackTrustFx.Result;
});
