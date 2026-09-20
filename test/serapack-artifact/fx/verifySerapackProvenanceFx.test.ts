import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SerapackDistributionChannel } from "~/serapack-artifact/constant/SerapackDistributionChannel";
import { encodeTestSerapackEnvelopeFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { verifySerapackProofFx } from "~/serapack-artifact/fx/verifySerapackProofFx";
import { readTestSerapackContentHashFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { verifySerapackFileProvenanceWithFx } from "~/serapack-artifact/fx/verifySerapackFileProvenanceFx";
import { Magic } from "~/serapack-artifact/constant/Magic";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import fixture from "./verifySerapackProvenanceFx.test/official.fixture.json";

// This suite owns the isolated test-only Sigstore root and its one proof over this exact
// payload/channel. Production trust remains src/serapack-artifact/constant/trusted-root.json.
const payload = Uint8Array.from(Buffer.from(fixture.payloadBase64, "base64"));
const proof = new TextEncoder().encode(JSON.stringify(fixture.proof));
// The signed fixture has its own immutable channel; it does not track product renames.
const fixtureChannel = {
	issuer: SerapackDistributionChannel.issuer,
	subjectAlternativeName:
		/^https:\/\/github[.]com\/marek-hanzal\/arkini\/[.]github\/workflows\/release[.]yml@.+$/,
};
const verifyFixtureFx = (artifact: Uint8Array, candidateProof: Uint8Array | null = proof) =>
	verifySerapackProofFx({
		artifact,
		proof: candidateProof ?? undefined,
		channel: fixtureChannel,
		trustedRoot: fixture.trustedRoot,
	});

describe("Serapack release provenance", () => {
	it("verifies offline proofs and rejects tampering in the shipped Electron runtime", async () => {
		const electronPath: string = createRequire(import.meta.url)("electron");
		await promisify(execFile)(
			electronPath,
			[
				"--import",
				"tsx",
				"test/serapack-artifact/fx/verifySerapackProvenanceFx.test/electron.ts",
			],
			{
				env: {
					...process.env,
					ELECTRON_RUN_AS_NODE: "1",
				},
				timeout: 15_000,
			},
		);
	}, 20_000);

	it("keeps release versions outside the exact workflow channel identity", () => {
		const workflow = "https://github.com/marek-hanzal/serakki/.github/workflows/release.yml";
		expect(
			SerapackDistributionChannel.subjectAlternativeName.test(`${workflow}@refs/tags/v0.4.9`),
		).toBe(true);
		expect(
			SerapackDistributionChannel.subjectAlternativeName.test(
				`${workflow}@refs/tags/v0.6.0-dev.1`,
			),
		).toBe(true);
		expect(
			SerapackDistributionChannel.subjectAlternativeName.test(
				"https://github.com/pepa/serakki/.github/workflows/release.yml@refs/tags/v0.5.0",
			),
		).toBe(false);
		expect(SerapackDistributionChannel.subjectAlternativeName.test(workflow)).toBe(false);
	});

	it("offline-verifies the checked-in payload proof for its signed fixture channel", async () => {
		await expect(Effect.runPromise(verifyFixtureFx(payload))).resolves.toEqual({
			type: "official",
		});
	});

	it("does not trust the former repository proof after the Serakki channel rename", async () => {
		await expect(
			Effect.runPromise(
				verifySerapackProofFx({
					artifact: payload,
					proof,
					channel: SerapackDistributionChannel,
					trustedRoot: fixture.trustedRoot,
				}),
			),
		).resolves.toEqual({
			type: "community",
		});
	});

	it("does not accept a legacy payload proof as a file content-hash proof", async () => {
		const root = await mkdtemp(join(tmpdir(), "serakki-stream-proof-"));
		try {
			const serapackPath = join(root, "fixture.serapack");
			const release = await Effect.runPromise(
				encodeTestSerapackEnvelopeFx({
					payload,
					proof,
				}),
			);
			await writeFile(serapackPath, release);
			await expect(
				Effect.runPromise(
					verifySerapackFileProvenanceWithFx({
						layout: {
							serapackPath,
							contentHash: "0".repeat(64),
							configLength: 0,
							configOffset: Magic.byteLength + 4,
							manifest: {
								version: "1.0",
								serakki: SerakkiAppVersion,
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
			issuer: SerapackDistributionChannel.issuer,
			subjectAlternativeName:
				/^https:\/\/github[.]com\/pepa\/serakki\/[.]github\/workflows\/release[.]yml@.+$/,
		};
		const changedPayload = payload.slice();
		changedPayload[0] ^= 1;

		await expect(
			Effect.runPromise(
				verifySerapackProofFx({
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
			encodeTestSerapackEnvelopeFx({
				payload,
			}),
		);
		const malformed = await Effect.runPromise(
			encodeTestSerapackEnvelopeFx({
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
		await expect(Effect.runPromise(readTestSerapackContentHashFx(unsigned))).resolves.toBe(
			await Effect.runPromise(readTestSerapackContentHashFx(malformed)),
		);
	});
});
