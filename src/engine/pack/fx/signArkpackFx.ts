import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";
import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { createArkpackSigningPayloadFx } from "./createArkpackSigningPayloadFx";

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
	return yield* Effect.try({
		try: () =>
			ArkpackSignatureSchema.parse({
				keyId,
				signature,
			}),
		catch: (cause) =>
			new ArkpackInputError({
				operation: "create-signature",
				message:
					"Invalid Arkpack signing metadata; keyId must use 1-64 lowercase letters, digits, dots, underscores, or hyphens.",
				cause,
			}),
	});
});
