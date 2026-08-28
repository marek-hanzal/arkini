import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { ArkpackDistributionChannel } from "~/engine/pack/ArkpackDistributionChannel";
import { createArkpackDistributionChannelFx } from "~/engine/pack/fx/createArkpackDistributionChannelFx";
import { encodeArkpackEnvelopeFx } from "~/engine/pack/fx/encodeArkpackEnvelopeFx";
import { createArkpackProvenanceVerifier } from "~/engine/pack/fx/verifyArkpackProvenanceFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import fixture from "./verifyArkpackProvenanceFx.test/official.fixture.json";

// This suite owns the isolated test-only Sigstore root and its one proof over this exact
// payload/channel. Production trust remains src/engine/pack/trusted-root.json.
const payload = Uint8Array.from(Buffer.from(fixture.payloadBase64, "base64"));
const proof = new TextEncoder().encode(JSON.stringify(fixture.proof));
const verify = createArkpackProvenanceVerifier({
	channel: ArkpackDistributionChannel,
	trustedRoot: fixture.trustedRoot,
});

describe("Arkpack release provenance", () => {
	it("offline-verifies the checked-in payload proof as Official", async () => {
		const release = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof,
			}),
		);

		expect(verify(release)).toEqual({
			type: "official",
		});
	});

	it("keeps the same proof Community for another channel or payload", async () => {
		const foreignChannel = Effect.runSync(
			createArkpackDistributionChannelFx({
				issuer: ArkpackDistributionChannel.issuer,
				workflow: "https://github.com/pepa/arkini/.github/workflows/release.yml",
			}),
		);
		const verifyForeignChannel = createArkpackProvenanceVerifier({
			channel: foreignChannel,
			trustedRoot: fixture.trustedRoot,
		});
		const release = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof,
			}),
		);
		const changedPayload = payload.slice();
		changedPayload[0] ^= 1;
		const changed = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload: changedPayload,
				proof,
			}),
		);

		expect(verifyForeignChannel(release)).toEqual({
			type: "community",
		});
		expect(verify(changed)).toEqual({
			type: "community",
		});
	});

	it("keeps missing or malformed proof Community without changing gameplay identity", async () => {
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
