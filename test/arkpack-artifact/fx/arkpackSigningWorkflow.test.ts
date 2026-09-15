import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { packDirectoryFx } from "~/arkpack-artifact/fx/packDirectoryFx";
import { decodeTestArkpackEnvelopeFx } from "~test/arkpack-support/fx/testArkpackCodecFx";
import { encodeTestArkpackEnvelopeFx } from "~test/arkpack-support/fx/testArkpackCodecFx";
import { installTestPngDecoder } from "~test/arkpack-support/fn/createTestPngBytes";
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

describe("local Arkpack build", () => {
	it("always republishes one unsigned artifact without retaining an embedded proof", async () => {
		const gameDirectory = await writeSigningGame(root);
		const first = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		const firstEnvelope = Effect.runSync(
			decodeTestArkpackEnvelopeFx(new Uint8Array(await readFile(first.arkpack))),
		);
		await writeFile(
			first.arkpack,
			Effect.runSync(
				encodeTestArkpackEnvelopeFx({
					payload: firstEnvelope.payload,
					proof: new TextEncoder().encode("{}"),
				}),
			),
		);

		const rebuilt = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		const rebuiltBytes = new Uint8Array(await readFile(rebuilt.arkpack));
		expect(rebuiltBytes.byteLength).toBe(rebuilt.bytes);
		expect(Effect.runSync(decodeTestArkpackEnvelopeFx(rebuiltBytes)).proof).toBeUndefined();
	});
});
