import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { createArkpackSigningPayloadFx } from "./createArkpackSigningPayloadFx";
import { readArkpackContentHashFx } from "./readArkpackContentHashFx";

export namespace signArkpackFx {
	export interface Props {
		readonly bytes: Uint8Array;
		readonly keyId: string;
		readonly privateKey: string;
	}
}

/** Signs exact Arkpack bytes with one explicit Ed25519 PKCS8 private key. */
export const signArkpackFx = Effect.fn("signArkpackFx")(function* ({
	bytes,
	keyId,
	privateKey,
}: signArkpackFx.Props) {
	const importedKey = yield* Effect.tryPromise({
		try: async () => {
			const encoded = privateKey
				.replace("-----BEGIN PRIVATE KEY-----", "")
				.replace("-----END PRIVATE KEY-----", "")
				.replaceAll(/\s/g, "");
			const decoded = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
			return await crypto.subtle.importKey(
				"pkcs8",
				decoded,
				{
					name: "Ed25519",
				},
				false,
				[
					"sign",
				],
			);
		},
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "import-private-key",
				cause,
			}),
	});
	const payload = yield* createArkpackSigningPayloadFx(bytes);
	const signatureBytes = yield* Effect.tryPromise({
		try: async () =>
			new Uint8Array(
				await crypto.subtle.sign(
					{
						name: "Ed25519",
					},
					importedKey,
					payload,
				),
			),
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "sign",
				cause,
			}),
	});
	const signature = btoa(
		Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join(""),
	);
	const contentHash = yield* readArkpackContentHashFx(bytes);

	return yield* Effect.sync(() =>
		ArkpackSignatureSchema.parse({
			formatVersion: 1,
			algorithm: "ed25519",
			keyId,
			contentHash,
			signature,
		}),
	);
});
