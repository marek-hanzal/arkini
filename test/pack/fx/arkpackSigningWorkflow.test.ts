import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { ArkpackSigningError } from "~/engine/pack/error/ArkpackSigningError";
import { generateArkpackKeyPairFx } from "~/engine/pack/fx/generateArkpackKeyPairFx";
import { packSignedDirectoryFx } from "~/engine/pack/fx/packSignedDirectoryFx";
import { signArkpackFx } from "~/engine/pack/fx/signArkpackFx";
import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";

const keyId = "test-workflow-2026-01";
let root = "";

beforeEach(async () => {
	installTestPngDecoder();
	root = await mkdtemp(join(tmpdir(), "arkini-signing-workflow-"));
});

afterEach(async () => {
	vi.unstubAllGlobals();
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
			keys: [
				{
					keyId,
					publicKey: pair.publicKey,
				},
			],
		});
		const arkpackPath = join(root, "workflow.game.arkpack");
		const untrustedKey = await Effect.runPromise(
			Effect.result(
				packSignedDirectoryFx({
					input: "game/demo",
					keyId,
					packageId: "untrusted-workflow",
					version: "1.0",
					output: join(root, "untrusted.game.arkpack"),
					privateKey: pair.privateKey,
					trustedKeys: {
						keys: [],
					},
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		);
		expect(untrustedKey._tag).toBe("Failure");
		if (untrustedKey._tag === "Failure") {
			expect(untrustedKey.failure).toBeInstanceOf(ArkpackSigningError);
			expect(untrustedKey.failure).toMatchObject({
				reason: "untrusted-key-id",
				keyId,
			});
		}

		const result = await Effect.runPromise(
			packSignedDirectoryFx({
				input: "game/demo",
				keyId,
				packageId: "test-workflow",
				version: "1.0",
				output: arkpackPath,
				privateKey: pair.privateKey,
				trustedKeys,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		const bytes = new Uint8Array(await readFile(arkpackPath));
		const signature = JSON.parse(await readFile(result.signaturePath, "utf8")) as unknown;

		await expect(
			Effect.runPromise(
				verifyArkpackFileFx({
					arkpackPath,
					trustedKeys,
				}).pipe(Effect.provide(NodeServices.layer)),
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
				packageId: "test-workflow",
				signature: {
					metadata: signature,
					trustedKeys,
				},
				source: "bundled",
			}),
		);
		expect(loaded.descriptor.trust).toEqual({
			type: "official",
			keyId,
		});
		expect(loaded.payload.config.meta.id).toBe("demo");

		const unsigned = await Effect.runPromise(
			readArkpackFx({
				bytes,
				signature: {
					trustedKeys,
				},
				source: "user",
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
				signature: {
					metadata: unknownSignature,
					trustedKeys,
				},
				source: "user",
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
