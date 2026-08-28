import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signArkpackFileFx } from "../../../src/engine/pack/fx/signArkpackFileFx";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-sign-arkpack-file-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("signArkpackFileFx", () => {
	it("holds the exact publication lock before reading bytes to sign", async () => {
		const arkpackPath = join(root, "game.arkpack");
		const lock = join(dirname(arkpackPath), `.${basename(arkpackPath)}.lock`);
		await writeFile(arkpackPath, Uint8Array.of(1));
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let lockHeldDuringRead = false;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			readFile: (target) =>
				String(target) !== arkpackPath
					? nodeFileSystem.readFile(target)
					: Effect.promise(async () => {
							await access(lock);
							lockHeldDuringRead = true;
						}).pipe(Effect.andThen(nodeFileSystem.readFile(target))),
		};

		await expect(
			Effect.runPromise(
				signArkpackFileFx({
					arkpackPath,
				}).pipe(
					Effect.provide(NodePath.layer),
					Effect.provideService(FileSystem.FileSystem, fileSystem),
				),
			),
		).rejects.toBeDefined();
		expect(lockHeldDuringRead).toBe(true);
	});
});
