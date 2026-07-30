import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { createHash } from "node:crypto";
import { access, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemArkpackCatalogFx } from "../../electron/main/arkpack/createFilesystemArkpackCatalogFx";

let root = "";
const packageBytes = new Uint8Array([
	1,
	2,
	3,
]);
const packageId = createHash("sha256").update(packageBytes).digest("hex");
const descriptor = {
	packageId,
	contentHash: packageId,
	gameId: "game:test",
	title: "Test",
	configVersion: "1.0",
	compressedSize: 3,
	trust: {
		type: "external",
		reason: "unsigned",
	} as const,
	source: "imported" as const,
	filename: "test.arkpack",
	importedAtMs: 1,
};

const createCatalog = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		createFilesystemArkpackCatalogFx({
			root: join(root, "arkini", "game", "arkpacks"),
			fileSystem,
		}).pipe(Effect.provide(NodeServices.layer)),
	);

const createNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

const createPromiseGate = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-arkpacks-"));
});
afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemArkpackCatalogFx", () => {
	it("installs, lists metadata without payload I/O, reads one exact binary and removes atomically", async () => {
		const catalog = await createCatalog();
		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		const restarted = await createCatalog();
		expect(await Effect.runPromise(restarted.listFx)).toEqual([
			descriptor,
		]);

		const binaryPath = join(root, "arkini", "game", "arkpacks", packageId, "package.arkpack");
		await unlink(binaryPath);
		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			descriptor,
		]);
		await expect(Effect.runPromise(catalog.readFx(packageId))).rejects.toBeDefined();

		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		expect(await Effect.runPromise(catalog.readFx(packageId))).toEqual({
			descriptor,
			bytes: packageBytes,
		});

		await Effect.runPromise(catalog.removeFx(packageId));
		await expect(access(join(root, "arkini", "game", "arkpacks", packageId))).rejects.toBeDefined();
	});

	it("deduplicates exact package identities and rejects unsafe paths", async () => {
		const catalog = await createCatalog();
		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		await Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		expect(await Effect.runPromise(catalog.listFx)).toHaveLength(1);
		await expect(
			Effect.runPromise(
				catalog.installFx({
					descriptor,
					bytes: new Uint8Array([
						9,
						9,
						9,
					]),
				}),
			),
		).rejects.toThrow("SHA-256");
		await expect(Effect.runPromise(catalog.readFx("../escape"))).rejects.toThrow(
			"Invalid imported Arkpack",
		);
	});

	it("serializes concurrent installs of the same package identity", async () => {
		const catalog = await createCatalog();
		const record = {
			descriptor,
			bytes: packageBytes,
		};

		await Promise.all([
			Effect.runPromise(catalog.installFx(record)),
			Effect.runPromise(catalog.installFx(record)),
		]);

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			descriptor,
		]);
	});

	it("preserves install-before-remove admission order across the repository", async () => {
		const nodeFileSystem = await createNodeFileSystem();
		const renameEntered = createPromiseGate();
		const releaseRename = createPromiseGate();
		let blockNextInstallRename = true;
		let removeStarted = false;
		const installedPackagePath = join(root, "arkini", "game", "arkpacks", packageId);
		const fileSystem = {
			...nodeFileSystem,
			remove: (path, options) => {
				if (path === installedPackagePath) {
					removeStarted = true;
				}
				return nodeFileSystem.remove(path, options);
			},
			rename: (oldPath, newPath) => {
				const renameFx = nodeFileSystem.rename(oldPath, newPath);
				if (!blockNextInstallRename || !oldPath.endsWith(".pending")) {
					return renameFx;
				}
				blockNextInstallRename = false;
				renameEntered.resolve();
				return Effect.promise(() => releaseRename.promise).pipe(Effect.andThen(renameFx));
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(fileSystem);

		const installing = Effect.runPromise(
			catalog.installFx({
				descriptor,
				bytes: packageBytes,
			}),
		);
		await renameEntered.promise;
		const removing = Effect.runPromise(catalog.removeFx(packageId));
		await new Promise<void>((resolve) => {
			setImmediate(resolve);
		});

		expect(removeStarted).toBe(false);
		releaseRename.resolve();
		await Promise.all([
			installing,
			removing,
		]);

		expect(removeStarted).toBe(true);
		expect(await Effect.runPromise(catalog.readFx(packageId))).toBeNull();
	});

	it("never trusts an imported descriptor without a persisted signature", async () => {
		const catalog = await createCatalog();
		await Effect.runPromise(
			catalog.installFx({
				descriptor: {
					...descriptor,
					trust: {
						type: "official",
						keyId: "forged-official",
					},
				},
				bytes: packageBytes,
			}),
		);

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			{
				...descriptor,
				trust: {
					type: "external",
					reason: "unsigned",
				},
			},
		]);
	});
});
