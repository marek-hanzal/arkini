import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createArkiniReleaseIdentity } from "~/engine/pack/ArkiniReleaseIdentity";
import { encodeArkpackEnvelopeFx } from "~/engine/pack/fx/encodeArkpackEnvelopeFx";
import { createArkpackProvenanceVerifier } from "~/engine/pack/fx/verifyArkpackProvenanceFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { createTestSigstore } from "./verifyArkpackProvenanceFx.test/createTestSigstore";

const payload = new TextEncoder().encode("deterministic compressed gameplay");
const identity = "https://github.com/marek-hanzal/arkini/.github/workflows/release.yml";
const version = "0.5.0-dev.550.1";
const subject = `${identity}@refs/tags/v${version}`;

describe("Arkpack release provenance", () => {
	it("proves only the exact payload, repository workflow, and full build version", async () => {
		const sigstore = await createTestSigstore();
		const verify = createArkpackProvenanceVerifier({
			identity: createArkiniReleaseIdentity({
				identity,
				issuer: "https://token.actions.githubusercontent.com",
				version,
			}),
			trustedRoot: sigstore.trustedRoot,
		});
		const proof = await sigstore.sign(payload, subject);
		const official = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode(JSON.stringify(proof)),
			}),
		);
		const otherVersionProof = await sigstore.sign(
			payload,
			`${identity}@refs/tags/v0.5.0-dev.550.2`,
		);
		const otherVersion = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode(JSON.stringify(otherVersionProof)),
			}),
		);
		const changedPayload = payload.slice();
		changedPayload[0] ^= 1;
		const changed = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload: changedPayload,
				proof: new TextEncoder().encode(JSON.stringify(proof)),
			}),
		);

		expect(verify(official)).toEqual({
			type: "official",
		});
		expect(verify(otherVersion)).toEqual({
			type: "community",
		});
		expect(verify(changed)).toEqual({
			type: "community",
		});
	});

	it("keeps missing or malformed proof Community without changing gameplay identity", async () => {
		const sigstore = await createTestSigstore();
		const verify = createArkpackProvenanceVerifier({
			identity: createArkiniReleaseIdentity({
				identity,
				issuer: "https://token.actions.githubusercontent.com",
				version,
			}),
			trustedRoot: sigstore.trustedRoot,
		});
		const unsigned = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
			}),
		);
		const malformed = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode("not-json"),
			}),
		);

		expect(verify(unsigned)).toEqual({
			type: "community",
		});
		expect(verify(malformed)).toEqual({
			type: "community",
		});
		await expect(Effect.runPromise(readArkpackContentHashFx(unsigned))).resolves.toBe(
			await Effect.runPromise(readArkpackContentHashFx(malformed)),
		);
	});
});
