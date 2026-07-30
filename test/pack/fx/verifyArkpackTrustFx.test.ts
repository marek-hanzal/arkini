import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { ArkpackCryptoError } from "~/engine/pack/error/ArkpackCryptoError";
import { createArkpackSigningPayloadFx } from "~/engine/pack/fx/createArkpackSigningPayloadFx";
import { generateArkpackKeyPairFx } from "~/engine/pack/fx/generateArkpackKeyPairFx";
import { signArkpackFx } from "~/engine/pack/fx/signArkpackFx";
import { verifyArkpackTrustFx } from "~/engine/pack/fx/verifyArkpackTrustFx";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

const keyId = "test-official-2026-01";
const bytes = new TextEncoder().encode("exact arkpack fixture bytes");
let keyPair: generateArkpackKeyPairFx.Result;
let wrongKeyPair: generateArkpackKeyPairFx.Result;

beforeAll(async () => {
	[keyPair, wrongKeyPair] = await Effect.runPromise(
		Effect.all(
			[
				generateArkpackKeyPairFx(),
				generateArkpackKeyPairFx(),
			],
			{
				concurrency: "unbounded",
			},
		),
	);
});

describe("Arkpack Ed25519 trust", () => {
	it("constructs the exact version-one domain-separated payload", () => {
		const payload = Effect.runSync(createArkpackSigningPayloadFx(bytes));
		expect(new TextDecoder().decode(payload)).toBe(
			`arkini:arkpack:v1\0${new TextDecoder().decode(bytes)}`,
		);
		expect(payload.slice(-bytes.byteLength)).toEqual(bytes);
	});

	it("signs deterministically and verifies with the matching trusted key", async () => {
		const first = await Effect.runPromise(
			signArkpackFx({
				bytes,
				keyId,
				privateKey: keyPair.privateKey,
			}),
		);
		const second = await Effect.runPromise(
			signArkpackFx({
				bytes,
				keyId,
				privateKey: keyPair.privateKey,
			}),
		);
		const trustedKeys = ArkpackTrustedKeysSchema.parse({
			keys: [
				{
					keyId,
					publicKey: keyPair.publicKey,
				},
			],
		});

		expect(second).toEqual(first);
		const verified = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				signature: first,
				trustedKeys,
			}),
		);
		expect(verified.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(verified.trust).toEqual({
			type: "official",
			keyId,
		});
	});

	it("distinguishes unsigned, unknown-key, byte mutation, and signature mutation", async () => {
		const signature = await Effect.runPromise(
			signArkpackFx({
				bytes,
				keyId,
				privateKey: keyPair.privateKey,
			}),
		);
		const trustedKeys = ArkpackTrustedKeysSchema.parse({
			keys: [
				{
					keyId,
					publicKey: keyPair.publicKey,
				},
			],
		});
		const unsigned = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				trustedKeys,
			}),
		);
		const unknown = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				signature: {
					...signature,
					keyId: "unknown-key",
				},
				trustedKeys,
			}),
		);
		const changedBytes = bytes.slice();
		changedBytes[0] = (changedBytes[0] ?? 0) ^ 1;
		const changed = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes: changedBytes,
				signature,
				trustedKeys,
			}),
		);
		const decodedSignature = Uint8Array.from(atob(signature.signature), (character) =>
			character.charCodeAt(0),
		);
		decodedSignature[0] = (decodedSignature[0] ?? 0) ^ 1;
		const invalid = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				signature: {
					...signature,
					signature: btoa(
						Array.from(decodedSignature, (byte) => String.fromCharCode(byte)).join(""),
					),
				},
				trustedKeys,
			}),
		);

		expect(unsigned.trust).toEqual({
			type: "external",
			reason: "unsigned",
		});
		expect(unknown.trust).toEqual({
			type: "external",
			reason: "unknown-key",
		});
		expect(changed.trust).toEqual({
			type: "invalid",
			reason: "invalid-signature",
			keyId,
		});
		expect(invalid.trust).toEqual({
			type: "invalid",
			reason: "invalid-signature",
			keyId,
		});
	});

	it("distinguishes malformed metadata, wrong keys, and malformed key material", async () => {
		const signature = await Effect.runPromise(
			signArkpackFx({
				bytes,
				keyId,
				privateKey: keyPair.privateKey,
			}),
		);
		const wrongTrustedKeys = ArkpackTrustedKeysSchema.parse({
			keys: [
				{
					keyId,
					publicKey: wrongKeyPair.publicKey,
				},
			],
		});
		const malformed = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				signature: {
					nope: true,
				},
				trustedKeys: wrongTrustedKeys,
			}),
		);
		const wrongKey = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				signature,
				trustedKeys: wrongTrustedKeys,
			}),
		);
		const malformedTrustedKeys = {
			keys: [
				{
					keyId,
					publicKey: "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n",
				},
			],
		};
		const malformedKey = await Effect.runPromise(
			Effect.result(
				verifyArkpackTrustFx({
					bytes,
					signature,
					trustedKeys: malformedTrustedKeys,
				}),
			),
		);

		expect(malformed.trust).toEqual({
			type: "invalid",
			reason: "malformed-signature",
		});
		expect(wrongKey.trust).toEqual({
			type: "invalid",
			reason: "invalid-signature",
			keyId,
		});
		expect(malformedKey._tag).toBe("Failure");
		if (malformedKey._tag === "Failure") {
			expect(malformedKey.failure).toBeInstanceOf(ArkpackCryptoError);
			expect(malformedKey.failure.operation).toBe("import-public-key");
		}
	});
});
