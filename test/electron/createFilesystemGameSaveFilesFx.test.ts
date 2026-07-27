import { FileSystem } from "effect";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, Option } from "effect";
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
const demo = {
	packageId: "demo",
	contentHash: "c".repeat(64),
};

const createRepository = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		createFilesystemGameSaveFilesFx({
			userDataPath: root,
			fileSystem,
		}).pipe(Effect.provide(NodeServices.layer)),
	);

const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

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

	it("persists saves for safe stable built-in package identities", async () => {
		const repository = await createRepository();
		const bytes = new Uint8Array([
			7,
			8,
			9,
		]);

		await Effect.runPromise(repository.writeFx(demo, bytes));
		expect(await Effect.runPromise(repository.readFx(demo))).toEqual(bytes);
		expect(
			new Uint8Array(
				await readFile(
					join(
						root,
						"arkini",
						"saves",
						demo.packageId,
						demo.contentHash,
						"current.arksave",
					),
				),
			),
		).toEqual(bytes);
		await Effect.runPromise(repository.clearFx(demo));
		expect(await Effect.runPromise(repository.readFx(demo))).toBeNull();
	});

	it("serializes concurrent writes before either can reuse the shared pending path", async () => {
		const fileSystem = await readNodeFileSystem();
		const firstRenameEntered = Effect.runSync(Deferred.make<void>());
		const releaseFirstRename = Effect.runSync(Deferred.make<void>());
		const secondRenameEntered = Effect.runSync(Deferred.make<void>());
		let renameCalls = 0;
		const gatedFileSystem: FileSystem.FileSystem = {
			...fileSystem,
			rename: (oldPath, newPath) =>
				Effect.suspend(() => {
					renameCalls += 1;
					const rename = fileSystem.rename(oldPath, newPath);
					if (renameCalls === 1) {
						return Deferred.succeed(firstRenameEntered, undefined).pipe(
							Effect.andThen(Deferred.await(releaseFirstRename)),
							Effect.andThen(rename),
						);
					}
					return Deferred.succeed(secondRenameEntered, undefined).pipe(
						Effect.andThen(rename),
					);
				}),
		};
		const repository = await createRepository(gatedFileSystem);
		const firstWrite = Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
				]),
			),
		);
		await Effect.runPromise(Deferred.await(firstRenameEntered));

		const secondWrite = Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					2,
				]),
			),
		);
		expect(Option.isNone(await Effect.runPromise(Deferred.poll(secondRenameEntered)))).toBe(
			true,
		);

		Effect.runSync(Deferred.succeed(releaseFirstRename, undefined));
		await Promise.all([
			firstWrite,
			secondWrite,
		]);

		expect(await Effect.runPromise(repository.readFx(first))).toEqual(
			new Uint8Array([
				2,
			]),
		);
		await expect(
			access(join(root, "arkini", "saves", "arkini", first.contentHash, "pending.arksave")),
		).rejects.toBeDefined();
	});

	it("orders clear after an already admitted write", async () => {
		const fileSystem = await readNodeFileSystem();
		const renameEntered = Effect.runSync(Deferred.make<void>());
		const releaseRename = Effect.runSync(Deferred.make<void>());
		const clearEntered = Effect.runSync(Deferred.make<void>());
		const saveDirectory = join(root, "arkini", "saves", first.packageId, first.contentHash);
		const gatedFileSystem: FileSystem.FileSystem = {
			...fileSystem,
			rename: (oldPath, newPath) =>
				Deferred.succeed(renameEntered, undefined).pipe(
					Effect.andThen(Deferred.await(releaseRename)),
					Effect.andThen(fileSystem.rename(oldPath, newPath)),
				),
			remove: (path, options) =>
				String(path) === saveDirectory
					? Deferred.succeed(clearEntered, undefined).pipe(
							Effect.andThen(fileSystem.remove(path, options)),
						)
					: fileSystem.remove(path, options),
		};
		const repository = await createRepository(gatedFileSystem);
		const write = Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					1,
				]),
			),
		);
		await Effect.runPromise(Deferred.await(renameEntered));

		const clear = Effect.runPromise(repository.clearFx(first));
		expect(Option.isNone(await Effect.runPromise(Deferred.poll(clearEntered)))).toBe(true);

		Effect.runSync(Deferred.succeed(releaseRename, undefined));
		await Promise.all([
			write,
			clear,
		]);
		expect(await Effect.runPromise(repository.readFx(first))).toBeNull();
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
			}).pipe(Effect.provide(NodeServices.layer)),
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

	it("releases save serialization after a failed operation", async () => {
		const fileSystem = await readNodeFileSystem();
		let renameCalls = 0;
		const failingOnceFileSystem: FileSystem.FileSystem = {
			...fileSystem,
			rename: (oldPath, newPath) =>
				Effect.suspend(() => {
					renameCalls += 1;
					return renameCalls === 1
						? Effect.die(new Error("rename failed"))
						: fileSystem.rename(oldPath, newPath);
				}),
		};
		const repository = await createRepository(failingOnceFileSystem);
		await expect(
			Effect.runPromise(
				repository.writeFx(
					first,
					new Uint8Array([
						1,
					]),
				),
			),
		).rejects.toThrow("rename failed");

		await Effect.runPromise(
			repository.writeFx(
				first,
				new Uint8Array([
					2,
				]),
			),
		);
		expect(await Effect.runPromise(repository.readFx(first))).toEqual(
			new Uint8Array([
				2,
			]),
		);
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
