import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realpath } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateArkpackKeyPairFx } from "~/engine/pack/fx/generateArkpackKeyPairFx";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";
import { writeSigningGame } from "./arkpackSigningWorkflow.test/writeSigningGame";

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
	it("publishes one signed canonical pair and verifies its exact bytes", async () => {
		const gameDirectory = await writeSigningGame(root);
		const pair = await Effect.runPromise(generateArkpackKeyPairFx());
		const result = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
				signing: {
					signKey: pair.signKey,
					publicKey: pair.publicKey,
				},
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		const canonicalGameDirectory = await realpath(gameDirectory);
		expect(result.arkpack).toBe(join(canonicalGameDirectory, "build", result.filename));
		expect(result.signaturePath).toBe(
			join(canonicalGameDirectory, "build", result.signatureFilename!),
		);
		expect((await readFile(result.arkpack)).byteLength).toBe(result.bytes);
		await expect(
			Effect.runPromise(
				verifyArkpackFileFx({
					arkpackPath: result.arkpack,
					publicKey: pair.publicKey,
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).resolves.toMatchObject({
			trust: {
				type: "official",
			},
		});
	});

	it("removes a stale signature when the same project is rebuilt unsigned", async () => {
		const gameDirectory = await writeSigningGame(root);
		const pair = await Effect.runPromise(generateArkpackKeyPairFx());
		const signed = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
				signing: {
					signKey: pair.signKey,
					publicKey: pair.publicKey,
				},
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		const unsigned = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(unsigned.signaturePath).toBeUndefined();
		await expect(readFile(signed.signaturePath!)).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
