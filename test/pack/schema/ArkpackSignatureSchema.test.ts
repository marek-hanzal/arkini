import { describe, expect, it } from "vitest";

import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";
import { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

const validSignature = {
	formatVersion: 1,
	algorithm: "ed25519",
	keyId: "arkini-official-2026-01",
	contentHash: "a".repeat(64),
	signature: btoa("\0".repeat(64)),
};

describe("Arkpack signing schemas", () => {
	it("accepts only the canonical version-one sidecar shape", () => {
		expect(ArkpackSignatureSchema.parse(validSignature)).toEqual(validSignature);
		expect(
			ArkpackSignatureSchema.safeParse({
				...validSignature,
				formatVersion: 2,
			}).success,
		).toBe(false);
		expect(
			ArkpackSignatureSchema.safeParse({
				...validSignature,
				algorithm: "hmac",
			}).success,
		).toBe(false);
		expect(
			ArkpackSignatureSchema.safeParse({
				...validSignature,
				signature: btoa("too short"),
			}).success,
		).toBe(false);
	});

	it("keeps official, external, and invalid trust states explicit", () => {
		expect(
			ArkpackTrustSchema.parse({
				type: "official",
				keyId: validSignature.keyId,
			}),
		).toEqual({
			type: "official",
			keyId: validSignature.keyId,
		});
		expect(
			ArkpackTrustSchema.parse({
				type: "external",
				reason: "unsigned",
			}),
		).toEqual({
			type: "external",
			reason: "unsigned",
		});
		expect(
			ArkpackTrustSchema.parse({
				type: "invalid",
				reason: "hash-mismatch",
				keyId: validSignature.keyId,
			}),
		).toEqual({
			type: "invalid",
			reason: "hash-mismatch",
			keyId: validSignature.keyId,
		});
	});

	it("rejects duplicate trusted key identities", () => {
		const key = {
			algorithm: "ed25519",
			keyId: validSignature.keyId,
			publicKey: "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n",
		};
		expect(
			ArkpackTrustedKeysSchema.safeParse({
				formatVersion: 1,
				keys: [
					key,
					key,
				],
			}).success,
		).toBe(false);
	});
});
