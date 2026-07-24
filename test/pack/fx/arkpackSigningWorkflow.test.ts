import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { generateArkpackKeyPairFx } from "~/engine/pack/fx/generateArkpackKeyPairFx";
import { packSignedDirectoryFx } from "~/engine/pack/fx/packSignedDirectoryFx";
import { signArkpackFx } from "~/engine/pack/fx/signArkpackFx";
import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

const keyId = "test-workflow-2026-01";
let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-signing-workflow-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("Arkpack signing workflow", () => {
	it("packs, signs, verifies, loads, and distinguishes every trust boundary", async () => {
		const [pair, unknownPair] = await Effect.runPromise(
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
		const trustedKeys = ArkpackTrustedKeysSchema.parse({
			formatVersion: 1,
			keys: [
				{
					algorithm: "ed25519",
					keyId,
					publicKey: pair.publicKey,
				},
			],
		});
		const arkpackPath = join(root, "workflow.game.arkpack");
		const result = await Effect.runPromise(
			packSignedDirectoryFx({
				input: "game/demo",
				keyId,
				metadata: {
					output: join(root, "workflow.metadata.json"),
					packageId: "test-workflow",
				},
				output: arkpackPath,
				privateKey: pair.privateKey,
				trustedKeys,
			}).pipe(Effect.provide(NodeContext.layer)),
		);
		const bytes = new Uint8Array(await readFile(arkpackPath));
		const signature = JSON.parse(await readFile(result.signaturePath, "utf8")) as unknown;

		await expect(
			Effect.runPromise(
				verifyArkpackFileFx({
					arkpackPath,
					trustedKeys,
				}).pipe(Effect.provide(NodeContext.layer)),
			),
		).resolves.toMatchObject({
			trust: {
				type: "official",
				keyId,
			},
		});
		const loaded = await Effect.runPromise(
			readArkpackFx({
				bytes,
				expectedOfficialKeyId: keyId,
				packageId: "test-workflow",
				signature,
				source: "built-in",
				trustedKeys,
			}),
		);
		expect(loaded.descriptor.trust).toEqual({
			type: "official",
			keyId,
		});
		expect(loaded.payload.config.meta.id).toBe("demo");

		const mutated = bytes.slice();
		mutated[mutated.byteLength - 1] = (mutated[mutated.byteLength - 1] ?? 0) ^ 1;
		await expect(
			Effect.runPromise(
				readArkpackFx({
					bytes: mutated,
					expectedOfficialKeyId: keyId,
					signature,
					source: "built-in",
					trustedKeys,
				}),
			),
		).rejects.toThrow("expected official signature");

		const unsigned = await Effect.runPromise(
			readArkpackFx({
				bytes,
				source: "imported",
				trustedKeys,
			}),
		);
		expect(unsigned.descriptor.trust).toEqual({
			type: "external",
			reason: "unsigned",
		});

		const unknownSignature = await Effect.runPromise(
			signArkpackFx({
				bytes,
				keyId: "unknown-test-key",
				privateKey: unknownPair.privateKey,
			}),
		);
		const unknown = await Effect.runPromise(
			readArkpackFx({
				bytes,
				signature: unknownSignature,
				source: "imported",
				trustedKeys,
			}),
		);
		expect(unknown.descriptor.trust).toEqual({
			type: "external",
			reason: "unknown-key",
		});
		expect(bytes).toEqual(new Uint8Array(await readFile(arkpackPath)));
		expect(trustedKeys.keys).toHaveLength(1);
	});
});
