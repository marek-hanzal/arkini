import { z } from "zod";

const keyIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const ArkpackTrustedKeysSchema = z
	.object({
		formatVersion: z.literal(1).describe("The trusted-key registry format version."),
		keys: z
			.array(
				z
					.object({
						algorithm: z.literal("ed25519"),
						keyId: z.string().regex(keyIdPattern),
						publicKey: z
							.string()
							.regex(
								/^-----BEGIN PUBLIC KEY-----\n(?:[A-Za-z0-9+/=]{1,64}\n)+-----END PUBLIC KEY-----\n$/,
							),
					})
					.strict(),
			)
			.superRefine((keys, context) => {
				const seen = new Set<string>();
				for (const [index, key] of keys.entries()) {
					if (seen.has(key.keyId)) {
						context.addIssue({
							code: "custom",
							message: `Duplicate trusted Arkpack keyId ${key.keyId}.`,
							path: [
								index,
								"keyId",
							],
						});
					}
					seen.add(key.keyId);
				}
			}),
	})
	.strict()
	.meta({
		id: "ArkpackTrustedKeysSchema",
		description: "Versioned immutable Ed25519 public-key registry for Arkpack verification.",
	});

export type ArkpackTrustedKeysSchema = typeof ArkpackTrustedKeysSchema;

export namespace ArkpackTrustedKeysSchema {
	export type Type = z.infer<ArkpackTrustedKeysSchema>;
}
