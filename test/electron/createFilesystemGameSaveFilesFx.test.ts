import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemGameSaveFilesFx } from "../../electron/main/save/createFilesystemGameSaveFilesFx";

let root = "";
const first = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
};
const second = {
	packageId: "arkini",
	contentHash: "b".repeat(64),
};

const createRepository = () =>
	Effect.runPromise(
		createFilesystemGameSaveFilesFx({
			userDataPath: root,
		}).pipe(Effect.provide(NodeContext.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-saves-"));
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemGameSaveFilesFx", () => {
	it("writes exact saves through pending/current replacement and isolates clear", async () => {
		const repository = await createRepository();
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
					2,
				]),
			),
		);
		await Effect.runPromise(
			repository.writeFx(
				second,
				new Uint8Array([
					3,
					4,
				]),
			),
		);
		expect(await Effect.runPromise(repository.readFx(first))).toEqual(
			new Uint8Array([
				1,
				2,
			]),
		);
		expect(await Effect.runPromise(repository.readFx(second))).toEqual(
			new Uint8Array([
				3,
				4,
			]),
		);
		await expect(
			access(join(root, "arkini", "saves", "arkini", first.contentHash, "pending.arksave")),
		).rejects.toBeDefined();
		await Effect.runPromise(repository.clearFx(first));
		expect(await Effect.runPromise(repository.readFx(first))).toBeNull();
		expect(await Effect.runPromise(repository.readFx(second))).toEqual(
			new Uint8Array([
				3,
				4,
			]),
		);
	});

	it("preserves the previous current save when atomic replacement fails", async () => {
		const repository = await createRepository();
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
					2,
					3,
				]),
			),
		);
		const failing = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				return yield* createFilesystemGameSaveFilesFx({
					userDataPath: root,
					fileSystem: {
						...fileSystem,
						rename: () => Effect.die(new Error("rename failed")),
					},
				});
			}).pipe(Effect.provide(NodeContext.layer)),
		);
		await expect(
			Effect.runPromise(
				failing.writeFx(
					first,
					new Uint8Array([
						9,
					]),
				),
			),
		).rejects.toThrow("rename failed");
		expect(await Effect.runPromise(repository.readFx(first))).toEqual(
			new Uint8Array([
				1,
				2,
				3,
			]),
		);
		await expect(
			access(join(root, "arkini", "saves", "arkini", first.contentHash, "pending.arksave")),
		).rejects.toBeDefined();
	});

	it("replaces the complete current file and rejects unsafe keys", async () => {
		const repository = await createRepository();
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
					2,
					3,
					4,
				]),
			),
		);
		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					9,
				]),
			),
		);
		const path = join(root, "arkini", "saves", "arkini", first.contentHash, "current.arksave");
		expect(new Uint8Array(await readFile(path))).toEqual(
			new Uint8Array([
				9,
			]),
		);
		await expect(
			Effect.runPromise(
				repository.writeFx(
					{
						packageId: "../escape",
						contentHash: first.contentHash,
					},
					new Uint8Array(),
				),
			),
		).rejects.toThrow("Invalid Arkini save identity");
	});
});
