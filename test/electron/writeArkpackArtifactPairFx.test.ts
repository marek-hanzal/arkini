import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeArkpackArtifactPairFx } from "../../electron/main/arkpack/writeArkpackArtifactPairFx";

const signature = (byte: number) => btoa(String.fromCharCode(...new Uint8Array(64).fill(byte)));
let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-arkpack-pair-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("writeArkpackArtifactPairFx", () => {
	it("replaces the exact pair and removes a stale signature", async () => {
		const fileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const arkpackPath = join(root, "game.arkpack");
		const signaturePath = join(root, "game.arksig");
		await Effect.runPromise(
			writeArkpackArtifactPairFx({
				arkpackPath,
				bytes: Uint8Array.of(1, 2, 3),
				fileSystem,
				signature: signature(1),
			}),
		);
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(Uint8Array.of(1, 2, 3));
		expect((await readFile(signaturePath, "utf8")).trim()).toBe(signature(1));

		await Effect.runPromise(
			writeArkpackArtifactPairFx({
				arkpackPath,
				bytes: Uint8Array.of(4, 5, 6),
				fileSystem,
			}),
		);
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(Uint8Array.of(4, 5, 6));
		await expect(readFile(signaturePath)).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
