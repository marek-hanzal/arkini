import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import type { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";
import { createArkpackSigningPayloadFx } from "./createArkpackSigningPayloadFx";
import { readArkpackContentHashFx } from "./readArkpackContentHashFx";

export namespace verifyArkpackTrustFx {
	export interface Props {
		readonly bytes: Uint8Array;
		readonly signature?: unknown;
		readonly trustedKeys: ArkpackTrustedKeysSchema.Type;
	}

	export interface Result {
		readonly contentHash: string;
		readonly trust: ArkpackTrustSchema.Type;
	}
}

/** Classifies exact Arkpack bytes against optional detached metadata and explicit trusted keys. */
export const verifyArkpackTrustFx = Effect.fn("verifyArkpackTrustFx")(function* ({
	bytes,
	signature,
	trustedKeys,
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
	if (parsed.data.contentHash !== contentHash) {
		return {
			contentHash,
			trust: {
				type: "invalid",
				reason: "hash-mismatch",
				keyId: parsed.data.keyId,
			},
		} satisfies verifyArkpackTrustFx.Result;
	}
	const trustedKey = trustedKeys.keys.find((candidate) => candidate.keyId === parsed.data.keyId);
	if (trustedKey === undefined) {
		return {
			contentHash,
			trust: {
				type: "external",
				reason: "unknown-key",
			},
		} satisfies verifyArkpackTrustFx.Result;
	}
	const importedKey = yield* Effect.tryPromise({
		try: async () => {
			const encoded = trustedKey.publicKey
				.replace("-----BEGIN PUBLIC KEY-----", "")
				.replace("-----END PUBLIC KEY-----", "")
				.replaceAll(/\s/g, "");
			const decoded = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
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
	const signatureBytes = Uint8Array.from(atob(parsed.data.signature), (character) =>
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
					keyId: parsed.data.keyId,
				}
			: {
					type: "invalid",
					reason: "invalid-signature",
					keyId: parsed.data.keyId,
				},
	} satisfies verifyArkpackTrustFx.Result;
});
