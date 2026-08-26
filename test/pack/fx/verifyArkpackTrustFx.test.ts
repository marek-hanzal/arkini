import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { createArkpackSigningPayloadFx } from "~/engine/pack/fx/createArkpackSigningPayloadFx";
import { generateArkpackKeyPairFx } from "~/engine/pack/fx/generateArkpackKeyPairFx";
import { signArkpackFx } from "~/engine/pack/fx/signArkpackFx";
import { verifyArkpackTrustFx } from "~/engine/pack/fx/verifyArkpackTrustFx";

const bytes = new TextEncoder().encode("exact arkpack fixture bytes");
let pair: generateArkpackKeyPairFx.Result;
let otherPair: generateArkpackKeyPairFx.Result;

beforeAll(async () => {
	[pair, otherPair] = await Effect.runPromise(
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
	it("uses one stable domain-separated signing payload", () => {
		const payload = Effect.runSync(createArkpackSigningPayloadFx(bytes));
		expect(new TextDecoder().decode(payload)).toBe(
			`arkini:arkpack\0${new TextDecoder().decode(bytes)}`,
		);
	});

	it("accepts only a signature made by the one matching key", async () => {
		const signature = await Effect.runPromise(
			signArkpackFx({
				bytes,
				signKey: pair.signKey,
			}),
		);
		const official = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				publicKey: pair.publicKey,
				signature,
			}),
		);
		const wrongKey = await Effect.runPromise(
			verifyArkpackTrustFx({
				bytes,
				publicKey: otherPair.publicKey,
				signature,
			}),
		);

		expect(official.trust).toEqual({
			type: "official",
		});
		expect(wrongKey.trust).toEqual({
			type: "invalid",
			reason: "invalid-signature",
		});
	});

	it("distinguishes unsigned, malformed, and mutated artifacts", async () => {
		const signature = await Effect.runPromise(
			signArkpackFx({
				bytes,
				signKey: pair.signKey,
			}),
		);
		const changed = bytes.slice();
		changed[0] = (changed[0] ?? 0) ^ 1;
		const [unsigned, malformed, mutated] = await Effect.runPromise(
			Effect.all([
				verifyArkpackTrustFx({
					bytes,
					publicKey: pair.publicKey,
				}),
				verifyArkpackTrustFx({
					bytes,
					publicKey: pair.publicKey,
					signature: {},
				}),
				verifyArkpackTrustFx({
					bytes: changed,
					publicKey: pair.publicKey,
					signature,
				}),
			]),
		);

		expect(unsigned.trust).toEqual({
			type: "external",
			reason: "unsigned",
		});
		expect(malformed.trust).toEqual({
			type: "invalid",
			reason: "malformed-signature",
		});
		expect(mutated.trust).toEqual({
			type: "invalid",
			reason: "invalid-signature",
		});
	});
});
