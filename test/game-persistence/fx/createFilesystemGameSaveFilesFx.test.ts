import { FileSystem } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Option } from "effect";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemGameSaveFilesFx } from "~/game-persistence/fx/createFilesystemGameSaveFilesFx";
import { encodeGameProjectFileStemFn } from "~/game-config/source/encodeGameProjectFileStemFn";

let root = "";
const first = {
	packageId: "arkini",
};
const second = {
	packageId: "second",
};
const demo = {
	packageId: "demo",
};

const createRepository = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		createFilesystemGameSaveFilesFx({
			root: join(root, "arkini", "game", "saves"),
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
	it("writes package saves through pending/current replacement and isolates clear", async () => {
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
					join(root, "arkini", "game", "saves", demo.packageId, "current.arksave"),
				),
			),
		).toEqual(bytes);
		await Effect.runPromise(repository.clearFx(demo));
		expect(await Effect.runPromise(repository.readFx(demo))).toBeNull();
	});

	it("orders clear after an already admitted write", async () => {
		const fileSystem = await readNodeFileSystem();
		const renameEntered = Effect.runSync(Deferred.make<void>());
		const releaseRename = Effect.runSync(Deferred.make<void>());
		const clearEntered = Effect.runSync(Deferred.make<void>());
		const saveDirectory = join(root, "arkini", "game", "saves", first.packageId);
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

	it("replaces the complete current file and encodes every canonical package identity", async () => {
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
		const path = join(root, "arkini", "game", "saves", "arkini", "current.arksave");
		expect(new Uint8Array(await readFile(path))).toEqual(
			new Uint8Array([
				9,
			]),
		);
		const encoded = {
			packageId: "studio:game/one",
		};
		await Effect.runPromise(
			repository.writeFx(
				encoded,
				new Uint8Array([
					5,
				]),
			),
		);
		expect(await Effect.runPromise(repository.readFx(encoded))).toEqual(
			new Uint8Array([
				5,
			]),
		);
		await expect(
			access(
				join(
					root,
					"arkini",
					"game",
					"saves",
					encodeGameProjectFileStemFn(encoded.packageId),
					"current.arksave",
				),
			),
		).resolves.toBeUndefined();
		await expect(
			Effect.runPromise(
				repository.writeFx(
					{
						packageId: "",
					},
					new Uint8Array([
						6,
					]),
				),
			),
		).rejects.toMatchObject({
			_tag: "GameSaveFilesError",
			operation: "Invalid Arkini save identity",
		});
	});
});
