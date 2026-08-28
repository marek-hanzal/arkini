import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createArkpackDistributionChannelFx } from "~/engine/pack/fx/createArkpackDistributionChannelFx";
import { encodeArkpackEnvelopeFx } from "~/engine/pack/fx/encodeArkpackEnvelopeFx";
import { createArkpackProvenanceVerifier } from "~/engine/pack/fx/verifyArkpackProvenanceFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { createTestSigstore } from "./verifyArkpackProvenanceFx.test/createTestSigstore";

const payload = new TextEncoder().encode("deterministic compressed gameplay");
const workflow = "https://github.com/marek-hanzal/arkini/.github/workflows/release.yml";
const issuer = "https://token.actions.githubusercontent.com";
const channel = Effect.runSync(
	createArkpackDistributionChannelFx({
		issuer,
		workflow,
	}),
);

describe("Arkpack release provenance", () => {
	it("accepts older and newer release proofs from the configured distribution channel", async () => {
		const sigstore = await createTestSigstore();
		const verify = createArkpackProvenanceVerifier({
			channel,
			trustedRoot: sigstore.trustedRoot,
		});
		const olderProof = await sigstore.sign(payload, `${workflow}@refs/tags/v0.4.9`);
		const olderRelease = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode(JSON.stringify(olderProof)),
			}),
		);
		const newerProof = await sigstore.sign(payload, `${workflow}@refs/tags/v0.6.0-dev.1`);
		const newerRelease = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode(JSON.stringify(newerProof)),
			}),
		);

		expect(verify(olderRelease)).toEqual({
			type: "official",
		});
		expect(verify(newerRelease)).toEqual({
			type: "official",
		});
	});

	it("keeps foreign-channel and changed-payload proofs Community", async () => {
		const sigstore = await createTestSigstore();
		const verify = createArkpackProvenanceVerifier({
			channel,
			trustedRoot: sigstore.trustedRoot,
		});
		const proof = await sigstore.sign(payload, `${workflow}@refs/tags/v0.5.0`);
		const foreignProof = await sigstore.sign(
			payload,
			"https://github.com/pepa/arkini/.github/workflows/release.yml@refs/tags/v9.0.0",
		);
		const foreignChannel = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode(JSON.stringify(foreignProof)),
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

		expect(verify(foreignChannel)).toEqual({
			type: "community",
		});
		expect(verify(changed)).toEqual({
			type: "community",
		});
	});

	it("keeps missing or malformed proof Community without changing gameplay identity", async () => {
		const sigstore = await createTestSigstore();
		const verify = createArkpackProvenanceVerifier({
			channel,
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
