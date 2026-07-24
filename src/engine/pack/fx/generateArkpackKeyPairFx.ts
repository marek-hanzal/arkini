import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";

export namespace generateArkpackKeyPairFx {
	export interface Result {
		readonly privateKey: string;
		readonly publicKey: string;
	}
}

/** Generates one extractable Ed25519 PKCS8/SPKI key pair for maintainer tooling. */
export const generateArkpackKeyPairFx = Effect.fn("generateArkpackKeyPairFx")(() =>
	Effect.tryPromise({
		try: async (): Promise<generateArkpackKeyPairFx.Result> => {
			const pair = (await crypto.subtle.generateKey(
				{
					name: "Ed25519",
				},
				true,
				[
					"sign",
					"verify",
				],
			)) as CryptoKeyPair;
			const privateBytes = new Uint8Array(
				await crypto.subtle.exportKey("pkcs8", pair.privateKey),
			);
			const publicBytes = new Uint8Array(
				await crypto.subtle.exportKey("spki", pair.publicKey),
			);
			const pem = (label: "PRIVATE KEY" | "PUBLIC KEY", bytes: Uint8Array) => {
				const encoded = btoa(
					Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
				);
				const lines = encoded.match(/.{1,64}/g) ?? [];
				return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
			};

			return {
				privateKey: pem("PRIVATE KEY", privateBytes),
				publicKey: pem("PUBLIC KEY", publicBytes),
			};
		},
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "generate-key",
				cause,
			}),
	}),
);
