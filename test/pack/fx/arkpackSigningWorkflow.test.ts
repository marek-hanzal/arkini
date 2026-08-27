import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
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

describe("local Arkpack build", () => {
	it("always publishes one unsigned artifact and removes a stale release bundle", async () => {
		const gameDirectory = await writeSigningGame(root);
		const first = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		const signaturePath = join(first.build, first.filename.replace(/\.arkpack$/, ".arksig"));
		await writeFile(signaturePath, "{}");

		const rebuilt = await Effect.runPromise(
			packDirectoryFx({
				input: gameDirectory,
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect((await readFile(rebuilt.arkpack)).byteLength).toBe(rebuilt.bytes);
		await expect(readFile(signaturePath)).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
