import { Effect, FileSystem } from "effect";
import { access, mkdtemp, readFile, realpath, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SerapackLimits } from "~shared/SerapackLimits";
import {
	createBundledBytes,
	createCatalog,
	createNodeFileSystem,
	createPromiseGate,
	createUserBytes,
	readFileRecord,
	readPackagePath,
	readRoots,
	writePackage,
} from "./createFilesystemSerapackCatalogFx.test/fixture";

let root = "";

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "serakki-serapacks-")));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemSerapackCatalogFx", () => {
	it("discovers convention-named self-contained files without descriptors", async () => {
		const roots = readRoots(root);
		await writePackage({
			root: roots.bundled,
			packageId: "serakki",
			bytes: createBundledBytes("serakki"),
		});
		await writePackage({
			root: roots.user,
			packageId: "package.manual",
			bytes: createUserBytes("package.manual"),
		});
		await writeFile(join(roots.user, "descriptor.json"), "not catalog authority");

		const catalog = await createCatalog(root);

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			readFileRecord({
				packageId: "serakki",
				source: "bundled",
			}),
			readFileRecord({
				packageId: "package.manual",
				source: "user",
			}),
		]);
	});

	it("round-trips every admitted UTF-16 package identity without filename collisions", async () => {
		const packageIds = [
			"\ud800",
			"\udc00",
			"\ufffd",
			"%ED%A0%80",
		];
		const catalog = await createCatalog(root);

		for (let index = 0; index < packageIds.length; index += 1) {
			const packageId = packageIds[index];
			const source = join(root, `source-${index}.serapack`);
			await writeFile(source, createUserBytes(packageId));
			await Effect.runPromise(catalog.importFx(source));
			const loaded = await Effect.runPromise(catalog.readFx(packageId));
			expect(loaded).toHaveLength(1);
			const resourceUrl = new URL(loaded[0]!.resources[0]!.url);
			expect(JSON.parse(resourceUrl.searchParams.get("packageId")!)).toBe(packageId);
		}

		const files = await Effect.runPromise(catalog.listFx);
		expect(new Set(files.map(({ packageId }) => packageId))).toEqual(new Set(packageIds));
		expect(new Set(files.map(({ filename }) => filename)).size).toBe(packageIds.length);
	});

	it("prefers the user copy and reveals the untouched bundled package after removal", async () => {
		const roots = readRoots(root);
		const packageId = "serakki";
		const bundledPath = await writePackage({
			root: roots.bundled,
			packageId,
			bytes: createBundledBytes(packageId),
		});
		const userPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: createUserBytes(packageId),
		});
		const catalog = await createCatalog(root);
		const bundled = readFileRecord({
			packageId,
			source: "bundled",
		});
		const userOverride = readFileRecord({
			packageId,
			source: "user",
			overridesBundled: true,
		});

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			bundled,
			userOverride,
		]);
		expect(await Effect.runPromise(catalog.readFx(packageId))).toEqual([
			expect.objectContaining(bundled),
			expect.objectContaining(userOverride),
		]);

		await Effect.runPromise(catalog.removeFx(packageId));

		await expect(access(userPath)).rejects.toBeDefined();
		await expect(access(bundledPath)).resolves.toBeUndefined();
		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			readFileRecord({
				packageId,
				source: "bundled",
			}),
		]);
	});

	it("publishes a replacement import directly over the current user Serapack", async () => {
		const roots = readRoots(root);
		const packageId = "replace-import";
		const target = await writePackage({
			root: roots.user,
			packageId,
			bytes: createBundledBytes(packageId),
		});
		const replacement = createUserBytes(packageId);
		const source = join(root, "replacement.serapack");
		await writeFile(source, replacement);
		const catalog = await createCatalog(root);

		await expect(Effect.runPromise(catalog.importFx(source))).resolves.toMatchObject({
			packageId,
			version: "1.1",
		});
		expect(new Uint8Array(await readFile(target))).toEqual(replacement);
	});

	it("isolates an oversized manually copied package before reading its payload", async () => {
		const roots = readRoots(root);
		const packageId = "oversized";
		await writePackage({
			root: roots.bundled,
			packageId,
			bytes: createBundledBytes(packageId),
		});
		const path = await writePackage({
			root: roots.user,
			packageId,
			bytes: new Uint8Array(),
		});
		await truncate(path, SerapackLimits.maxSerapackBytes + 1);
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
			source: "bundled",
		});
		await expect(Effect.runPromise(catalog.listFx)).resolves.toEqual([
			bundled,
		]);
		await expect(Effect.runPromise(catalog.readFx(packageId))).resolves.toEqual([
			expect.objectContaining(bundled),
		]);
		expect(payloadRead).toBe(false);
	});

	it("uses the same aggregate-budget eligibility for listing and exact reads", async () => {
		const roots = readRoots(root);
		const packageId = "target";
		const bundledBytes = createBundledBytes(packageId);
		const firstUserBytes = createUserBytes("aaa");
		const targetUserBytes = createUserBytes(packageId);
		await Promise.all([
			writePackage({
				root: roots.bundled,
				packageId,
				bytes: bundledBytes,
			}),
			writePackage({
				root: roots.user,
				packageId: "aaa",
				bytes: firstUserBytes,
			}),
			writePackage({
				root: roots.user,
				packageId,
				bytes: targetUserBytes,
			}),
		]);
		const rootBudget = Math.max(bundledBytes.byteLength, firstUserBytes.byteLength) + 1;
		const catalog = await createCatalog(root, undefined, rootBudget * 2);
		const bundled = readFileRecord({
			packageId,
			source: "bundled",
		});

		await expect(Effect.runPromise(catalog.listFx)).resolves.toEqual([
			bundled,
			readFileRecord({
				packageId: "aaa",
				source: "user",
			}),
		]);
		await expect(Effect.runPromise(catalog.readFx(packageId))).resolves.toEqual([
			expect.objectContaining(bundled),
		]);
	});

	it("serializes install before a concurrently admitted removal", async () => {
		const roots = readRoots(root);
		const packageId = "serialized";
		const output = readPackagePath(roots.user, packageId);
		const nodeFileSystem = await createNodeFileSystem();
		const copyEntered = createPromiseGate();
		const releaseCopy = createPromiseGate();
		let removeStarted = false;
		const fileSystem = {
			...nodeFileSystem,
			remove: (path, options) => {
				if (path === output) removeStarted = true;
				return nodeFileSystem.remove(path, options);
			},
			copyFile: (oldPath, newPath) => {
				const copyFx = nodeFileSystem.copyFile(oldPath, newPath);
				if (newPath !== output) return copyFx;
				copyEntered.resolve();
				return Effect.promise(() => releaseCopy.promise).pipe(Effect.andThen(copyFx));
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);

		const source = join(root, "serialized-source.serapack");
		await writeFile(source, createUserBytes(packageId));
		const installing = Effect.runPromise(catalog.importFx(source));
		await copyEntered.promise;
		const removing = Effect.runPromise(catalog.removeFx(packageId));
		await new Promise<void>((resolve) => setImmediate(resolve));

		expect(removeStarted).toBe(false);
		releaseCopy.resolve();
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
			bytes: createBundledBytes(packageId),
		});
		const nodeFileSystem = await createNodeFileSystem();
		const copyEntered = createPromiseGate();
		const releaseCopy = createPromiseGate();
		let canonicalReadStarted = false;
		const fileSystem = {
			...nodeFileSystem,
			readFile: (path) => {
				if (path === output) canonicalReadStarted = true;
				return nodeFileSystem.readFile(path);
			},
			copyFile: (oldPath, newPath) => {
				const copyFx = nodeFileSystem.copyFile(oldPath, newPath);
				if (newPath !== output) return copyFx;
				copyEntered.resolve();
				return Effect.promise(() => releaseCopy.promise).pipe(Effect.andThen(copyFx));
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);
		const source = join(root, "locked-reader-source.serapack");
		await writeFile(source, createUserBytes(packageId));
		const writing = Effect.runPromise(catalog.importFx(source));
		await copyEntered.promise;
		const listing = Effect.runPromise(catalog.listFx);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(canonicalReadStarted).toBe(false);

		releaseCopy.resolve();
		await writing;
		await expect(listing).resolves.toEqual([
			readFileRecord({
				packageId,
				source: "user",
			}),
		]);
	});
});
