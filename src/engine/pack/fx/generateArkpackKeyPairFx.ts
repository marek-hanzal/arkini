import { Effect } from "effect";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";

export namespace generateArkpackKeyPairFx {
	export interface Result {
		readonly signKey: string;
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
			const publicKey = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
			const privateKey = (() => {
				const encoded = btoa(
					Array.from(privateBytes, (byte) => String.fromCharCode(byte)).join(""),
				);
				const lines = encoded.match(/.{1,64}/g) ?? [];
				return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
			})();

			return {
				signKey: btoa(
					Array.from(new TextEncoder().encode(privateKey), (byte) =>
						String.fromCharCode(byte),
					).join(""),
				),
				publicKey: btoa(
					Array.from(publicKey, (byte) => String.fromCharCode(byte)).join(""),
				),
			};
		},
		catch: (cause) =>
			new ArkpackCryptoError({
				operation: "generate-key",
				cause,
			}),
	}),
);
