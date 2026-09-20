import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ArkpackDistributionChannel } from "~/arkpack-artifact/constant/ArkpackDistributionChannel";
import { encodeTestArkpackEnvelopeFx } from "~test/arkpack-support/fx/testArkpackCodecFx";
import { verifyArkpackProofFx } from "~/arkpack-artifact/fx/verifyArkpackProofFx";
import { readTestArkpackContentHashFx } from "~test/arkpack-support/fx/testArkpackCodecFx";
import { verifyArkpackFileProvenanceWithFx } from "~/arkpack-artifact/fx/verifyArkpackFileProvenanceFx";
import { Magic } from "~/arkpack-artifact/constant/Magic";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import fixture from "./verifyArkpackProvenanceFx.test/official.fixture.json";

// This suite owns the isolated test-only Sigstore root and its one proof over this exact
// payload/channel. Production trust remains src/arkpack-artifact/constant/trusted-root.json.
const payload = Uint8Array.from(Buffer.from(fixture.payloadBase64, "base64"));
const proof = new TextEncoder().encode(JSON.stringify(fixture.proof));
// The signed fixture has its own immutable channel; it does not track product renames.
const fixtureChannel = {
	issuer: ArkpackDistributionChannel.issuer,
	subjectAlternativeName:
		/^https:\/\/github[.]com\/marek-hanzal\/arkini\/[.]github\/workflows\/release[.]yml@.+$/,
};
const verifyFixtureFx = (artifact: Uint8Array, candidateProof: Uint8Array | null = proof) =>
	verifyArkpackProofFx({
		artifact,
		proof: candidateProof ?? undefined,
		channel: fixtureChannel,
		trustedRoot: fixture.trustedRoot,
	});

describe("Arkpack release provenance", () => {
	it("keeps release versions outside the exact workflow channel identity", () => {
		const workflow = "https://github.com/marek-hanzal/serakki/.github/workflows/release.yml";
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

	it("offline-verifies the checked-in payload proof for its signed fixture channel", async () => {
		await expect(Effect.runPromise(verifyFixtureFx(payload))).resolves.toEqual({
			type: "official",
		});
	});

	it("does not trust the former repository proof after the Serakki channel rename", async () => {
		await expect(
			Effect.runPromise(
				verifyArkpackProofFx({
					artifact: payload,
					proof,
					channel: ArkpackDistributionChannel,
					trustedRoot: fixture.trustedRoot,
				}),
			),
		).resolves.toEqual({
			type: "community",
		});
	});

	it("does not accept a legacy payload proof as a file content-hash proof", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-stream-proof-"));
		try {
			const arkpackPath = join(root, "fixture.arkpack");
			const release = await Effect.runPromise(
				encodeTestArkpackEnvelopeFx({
					payload,
					proof,
				}),
			);
			await writeFile(arkpackPath, release);
			await expect(
				Effect.runPromise(
					verifyArkpackFileProvenanceWithFx({
						layout: {
							arkpackPath,
							contentHash: "0".repeat(64),
							configLength: 0,
							configOffset: Magic.byteLength + 4,
							manifest: {
								version: "1.0",
								arkini: ArkiniAppVersion,
								length: 0,
								resources: [],
							},
							payloadLength: payload.byteLength,
							payloadOffset: Magic.byteLength + 4,
							proof,
							resources: [],
							size: release.byteLength,
						},
						channel: fixtureChannel,
						trustedRoot: fixture.trustedRoot,
					}),
				),
			).resolves.toEqual({
				type: "community",
			});
		} finally {
			await rm(root, {
				force: true,
				recursive: true,
			});
		}
	});

	it("keeps the same proof Community for another channel or payload", async () => {
		const foreignChannel = {
			issuer: ArkpackDistributionChannel.issuer,
			subjectAlternativeName:
				/^https:\/\/github[.]com\/pepa\/arkini\/[.]github\/workflows\/release[.]yml@.+$/,
		};
		const changedPayload = payload.slice();
		changedPayload[0] ^= 1;

		await expect(
			Effect.runPromise(
				verifyArkpackProofFx({
					artifact: payload,
					proof,
					channel: foreignChannel,
					trustedRoot: fixture.trustedRoot,
				}),
			),
		).resolves.toEqual({
			type: "community",
		});
		await expect(Effect.runPromise(verifyFixtureFx(changedPayload))).resolves.toEqual({
			type: "community",
		});
	});

	it("keeps missing or malformed proof Community without changing gameplay identity", async () => {
		const unsigned = await Effect.runPromise(
			encodeTestArkpackEnvelopeFx({
				payload,
			}),
		);
		const malformed = await Effect.runPromise(
			encodeTestArkpackEnvelopeFx({
				payload,
				proof: new TextEncoder().encode("not-json"),
			}),
		);

		await expect(Effect.runPromise(verifyFixtureFx(payload, null))).resolves.toEqual({
			type: "community",
		});
		await expect(
			Effect.runPromise(verifyFixtureFx(payload, new TextEncoder().encode("not-json"))),
		).resolves.toEqual({
			type: "community",
		});
		await expect(Effect.runPromise(readTestArkpackContentHashFx(unsigned))).resolves.toBe(
			await Effect.runPromise(readTestArkpackContentHashFx(malformed)),
		);
	});
});
