import { Effect, FileSystem } from "effect";
import { access, mkdtemp, realpath, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkpackLimits } from "../../shared/ArkpackLimits";
import { writeArkpackFileFx } from "../../electron/main/arkpack/writeArkpackFileFx";
import {
	bundledBytes,
	createCatalog,
	createNodeFileSystem,
	createPromiseGate,
	readFileRecord,
	readPackagePath,
	readRoots,
	userBytes,
	writePackage,
} from "./createFilesystemArkpackCatalogFx.test/fixture";

let root = "";

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "arkini-arkpacks-")));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemArkpackCatalogFx", () => {
	it("discovers convention-named self-contained files without descriptors", async () => {
		const roots = readRoots(root);
		await writePackage({
			root: roots.bundled,
			packageId: "arkini",
			bytes: bundledBytes,
		});
		await writePackage({
			root: roots.user,
			packageId: "package.manual",
			bytes: userBytes,
		});
		await writeFile(join(roots.user, "descriptor.json"), "not catalog authority");

		const catalog = await createCatalog(root);

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			readFileRecord({
				packageId: "arkini",
				bytes: bundledBytes,
				source: "bundled",
			}),
			readFileRecord({
				packageId: "package.manual",
				bytes: userBytes,
				source: "user",
			}),
		]);
	});

	it("prefers the user copy and reveals the untouched bundled package after removal", async () => {
		const roots = readRoots(root);
		const packageId = "arkini";
		const bundledPath = await writePackage({
			root: roots.bundled,
			packageId,
			bytes: bundledBytes,
		});
		const userPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: userBytes,
		});
		const catalog = await createCatalog(root);
		const bundled = readFileRecord({
			packageId,
			bytes: bundledBytes,
			source: "bundled",
		});
		const userOverride = readFileRecord({
			packageId,
			bytes: userBytes,
			source: "user",
			overridesBundled: true,
		});

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			bundled,
			userOverride,
		]);
		expect(await Effect.runPromise(catalog.readFx(packageId))).toEqual([
			bundled,
			userOverride,
		]);

		await Effect.runPromise(catalog.removeFx(packageId));

		await expect(access(userPath)).rejects.toBeDefined();
		await expect(access(bundledPath)).resolves.toBeUndefined();
		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			readFileRecord({
				packageId,
				bytes: bundledBytes,
				source: "bundled",
			}),
		]);
	});

	it("isolates an oversized manually copied package before reading its payload", async () => {
		const roots = readRoots(root);
		const packageId = "oversized";
		await writePackage({
			root: roots.bundled,
			packageId,
			bytes: bundledBytes,
		});
		const path = await writePackage({
			root: roots.user,
			packageId,
			bytes: new Uint8Array(),
		});
		await truncate(path, ArkpackLimits.maxArkpackBytes + 1);
		const nodeFileSystem = await createNodeFileSystem();
		let payloadRead = false;
		const fileSystem = {
			...nodeFileSystem,
			readFile: (candidate) => {
				if (candidate === path) payloadRead = true;
				return nodeFileSystem.readFile(candidate);
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);

		const bundled = readFileRecord({
			packageId,
			bytes: bundledBytes,
			source: "bundled",
		});
		await expect(Effect.runPromise(catalog.listFx)).resolves.toEqual([
			bundled,
		]);
		await expect(Effect.runPromise(catalog.readFx(packageId))).resolves.toEqual([
			bundled,
		]);
		expect(payloadRead).toBe(false);
	});

	it("uses the same aggregate-budget eligibility for listing and exact reads", async () => {
		const roots = readRoots(root);
		const packageId = "target";
		await Promise.all([
			writePackage({
				root: roots.bundled,
				packageId,
				bytes: bundledBytes,
			}),
			writePackage({
				root: roots.user,
				packageId: "aaa",
				bytes: userBytes,
			}),
			writePackage({
				root: roots.user,
				packageId,
				bytes: userBytes,
			}),
		]);
		const catalog = await createCatalog(root, undefined, 6);
		const bundled = readFileRecord({
			packageId,
			bytes: bundledBytes,
			source: "bundled",
		});

		await expect(Effect.runPromise(catalog.listFx)).resolves.toEqual([
			bundled,
			readFileRecord({
				packageId: "aaa",
				bytes: userBytes,
				source: "user",
			}),
		]);
		await expect(Effect.runPromise(catalog.readFx(packageId))).resolves.toEqual([
			bundled,
		]);
	});

	it("serializes install before a concurrently admitted removal", async () => {
		const roots = readRoots(root);
		const packageId = "serialized";
		const output = readPackagePath(roots.user, packageId);
		const nodeFileSystem = await createNodeFileSystem();
		const renameEntered = createPromiseGate();
		const releaseRename = createPromiseGate();
		let removeStarted = false;
		const fileSystem = {
			...nodeFileSystem,
			remove: (path, options) => {
				if (path === output) removeStarted = true;
				return nodeFileSystem.remove(path, options);
			},
			rename: (oldPath, newPath) => {
				const renameFx = nodeFileSystem.rename(oldPath, newPath);
				if (newPath !== output) return renameFx;
				renameEntered.resolve();
				return Effect.promise(() => releaseRename.promise).pipe(Effect.andThen(renameFx));
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);

		const installing = Effect.runPromise(
			writeArkpackFileFx({
				arkpackPath: output,
				bytes: userBytes,
				fileSystem,
			}),
		);
		await renameEntered.promise;
		const removing = Effect.runPromise(catalog.removeFx(packageId));
		await new Promise<void>((resolve) => setImmediate(resolve));

		expect(removeStarted).toBe(false);
		releaseRename.resolve();
		await Promise.all([
			installing,
			removing,
		]);
		expect(removeStarted).toBe(true);
		expect(await Effect.runPromise(catalog.readFx(packageId))).toEqual([]);
	});

	it("reads one user file under the same lock as an external writer", async () => {
		const roots = readRoots(root);
		const packageId = "locked-reader";
		const output = await writePackage({
			root: roots.user,
			packageId,
			bytes: bundledBytes,
		});
		const nodeFileSystem = await createNodeFileSystem();
		const publicationEntered = createPromiseGate();
		const releasePublication = createPromiseGate();
		let canonicalReadStarted = false;
		const fileSystem = {
			...nodeFileSystem,
			readFile: (path) => {
				if (path === output) canonicalReadStarted = true;
				return nodeFileSystem.readFile(path);
			},
			rename: (oldPath, newPath) => {
				const renameFx = nodeFileSystem.rename(oldPath, newPath);
				if (newPath !== output) return renameFx;
				publicationEntered.resolve();
				return Effect.promise(() => releasePublication.promise).pipe(
					Effect.andThen(renameFx),
				);
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);
		const writing = Effect.runPromise(
			writeArkpackFileFx({
				arkpackPath: output,
				bytes: userBytes,
				fileSystem,
			}),
		);
		await publicationEntered.promise;
		const listing = Effect.runPromise(catalog.listFx);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(canonicalReadStarted).toBe(false);

		releasePublication.resolve();
		await writing;
		await expect(listing).resolves.toEqual([
			readFileRecord({
				packageId,
				bytes: userBytes,
				source: "user",
			}),
		]);
	});
});
