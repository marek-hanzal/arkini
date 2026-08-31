import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { ArkpackDistributionChannel } from "~/arkpack/artifact/ArkpackDistributionChannel";
import { encodeArkpackEnvelopeFx } from "~/arkpack/artifact/fx/encodeArkpackEnvelopeFx";
import { verifyArkpackProvenanceWithFx } from "~/arkpack/artifact/fx/verifyArkpackProvenanceFx";
import { readArkpackContentHashFx } from "~/arkpack/artifact/fx/readArkpackContentHashFx";
import fixture from "./verifyArkpackProvenanceFx.test/official.fixture.json";

// This suite owns the isolated test-only Sigstore root and its one proof over this exact
// payload/channel. Production trust remains src/arkpack/artifact/trusted-root.json.
const payload = Uint8Array.from(Buffer.from(fixture.payloadBase64, "base64"));
const proof = new TextEncoder().encode(JSON.stringify(fixture.proof));
const verifyFixtureFx = (bytes: Uint8Array) =>
	verifyArkpackProvenanceWithFx({
		bytes,
		channel: ArkpackDistributionChannel,
		trustedRoot: fixture.trustedRoot,
	});

describe("Arkpack release provenance", () => {
	it("keeps release versions outside the exact workflow channel identity", () => {
		const workflow = "https://github.com/marek-hanzal/arkini/.github/workflows/release.yml";
		expect(
			ArkpackDistributionChannel.subjectAlternativeName.test(`${workflow}@refs/tags/v0.4.9`),
		).toBe(true);
		expect(
			ArkpackDistributionChannel.subjectAlternativeName.test(
				`${workflow}@refs/tags/v0.6.0-dev.1`,
			),
		).toBe(true);
		expect(
			ArkpackDistributionChannel.subjectAlternativeName.test(
				"https://github.com/pepa/arkini/.github/workflows/release.yml@refs/tags/v0.5.0",
			),
		).toBe(false);
		expect(ArkpackDistributionChannel.subjectAlternativeName.test(workflow)).toBe(false);
	});

	it("offline-verifies the checked-in payload proof as Official", async () => {
		const release = await Effect.runPromise(
			encodeArkpackEnvelopeFx({
				payload,
				proof,
			}),
		);

		await expect(Effect.runPromise(verifyFixtureFx(release))).resolves.toEqual({
			type: "official",
		});
	});

	it("keeps the same proof Community for another channel or payload", async () => {
		const foreignChannel = {
			issuer: ArkpackDistributionChannel.issuer,
			subjectAlternativeName:
				/^https:\/\/github[.]com\/pepa\/arkini\/[.]github\/workflows\/release[.]yml@.+$/,
		};
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

		await expect(
			Effect.runPromise(
				verifyArkpackProvenanceWithFx({
					bytes: release,
					channel: foreignChannel,
					trustedRoot: fixture.trustedRoot,
				}),
			),
		).resolves.toEqual({
			type: "community",
		});
		await expect(Effect.runPromise(verifyFixtureFx(changed))).resolves.toEqual({
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

		await expect(Effect.runPromise(verifyFixtureFx(unsigned))).resolves.toEqual({
			type: "community",
		});
		await expect(Effect.runPromise(verifyFixtureFx(malformed))).resolves.toEqual({
			type: "community",
		});
		await expect(Effect.runPromise(readArkpackContentHashFx(unsigned))).resolves.toBe(
			await Effect.runPromise(readArkpackContentHashFx(malformed)),
		);
	});
});
