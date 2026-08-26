import { Effect, FileSystem } from "effect";
import { access, mkdtemp, readFile, readdir, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkpackLimits } from "../../shared/ArkpackLimits";
import {
	bundledBytes,
	createCatalog,
	createNodeFileSystem,
	createPromiseGate,
	readFileRecord,
	readPackagePath,
	readSignaturePath,
	readRoots,
	userBytes,
	writePackage,
} from "./createFilesystemArkpackCatalogFx.test/fixture";

let root = "";

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
	it("discovers convention-named files and their optional signatures without descriptors", async () => {
		const roots = readRoots(root);
		const signature = {
			signature: "detached-signature",
		};
		await writePackage({
			root: roots.bundled,
			packageId: "arkini",
			bytes: bundledBytes,
			signature,
		});
		await writePackage({
			root: roots.user,
			packageId: "package:manual",
			bytes: userBytes,
		});
		await writeFile(join(roots.user, "descriptor.json"), "not catalog authority");

		const catalog = await createCatalog(root);

		expect(await Effect.runPromise(catalog.listFx)).toEqual([
			readFileRecord({
				packageId: "arkini",
				bytes: bundledBytes,
				signature,
				source: "bundled",
			}),
			readFileRecord({
				packageId: "package:manual",
				bytes: userBytes,
				source: "user",
			}),
		]);
	});

	it("prefers the user copy and reveals the untouched bundled package after removal", async () => {
		const roots = readRoots(root);
		const packageId = "arkini";
		const userSignature = {
			signature: "user-signature",
		};
		const bundledPath = await writePackage({
			root: roots.bundled,
			packageId,
			bytes: bundledBytes,
		});
		const userPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: userBytes,
			signature: userSignature,
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
			signature: userSignature,
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
		await expect(access(readSignaturePath(roots.user, packageId))).rejects.toBeDefined();
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
		await truncate(path, ArkpackLimits.maxCompressedBytes + 1);
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

	it("cleans the pending file when install publication fails", async () => {
		const roots = readRoots(root);
		const packageId = "blocked-install";
		const output = readPackagePath(roots.user, packageId);
		const nodeFileSystem = await createNodeFileSystem();
		const fileSystem = {
			...nodeFileSystem,
			rename: (oldPath, newPath) =>
				oldPath.endsWith(".pending") && newPath === output
					? nodeFileSystem.rename(join(root, "missing-arkpack"), newPath)
					: nodeFileSystem.rename(oldPath, newPath),
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);

		await expect(
			Effect.runPromise(
				catalog.installFx({
					packageId,
					bytes: userBytes,
				}),
			),
		).rejects.toBeDefined();

		expect((await readdir(roots.user)).filter((entry) => entry.endsWith(".pending"))).toEqual(
			[],
		);
		await expect(access(output)).rejects.toBeDefined();
	});

	it.each([
		{
			failure: "backup" as const,
			previous: true,
		},
		{
			failure: "publication" as const,
			previous: true,
		},
		{
			failure: "publication" as const,
			previous: false,
		},
	])("rolls back the pair when $failure fails with previous=$previous", async (scenario) => {
		const roots = readRoots(root);
		const packageId = "atomic-pair";
		const oldSignature = {
			signature: btoa(String.fromCharCode(...new Uint8Array(64).fill(1))),
		};
		const nextSignature = {
			signature: btoa(String.fromCharCode(...new Uint8Array(64).fill(2))),
		};
		const output = readPackagePath(roots.user, packageId);
		if (scenario.previous)
			await writePackage({
				root: roots.user,
				packageId,
				bytes: bundledBytes,
				signature: oldSignature,
			});
		const signatureOutput = readSignaturePath(roots.user, packageId);
		const nodeFileSystem = await createNodeFileSystem();
		const fileSystem = {
			...nodeFileSystem,
			rename: (oldPath, newPath) =>
				(
					scenario.failure === "backup"
						? oldPath === signatureOutput && newPath.endsWith(".previous")
						: oldPath.endsWith(".pending") && newPath === signatureOutput
				)
					? nodeFileSystem.rename(join(root, "missing-signature"), newPath)
					: nodeFileSystem.rename(oldPath, newPath),
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);

		await expect(
			Effect.runPromise(
				catalog.installFx({
					packageId,
					bytes: userBytes,
					signature: nextSignature,
				}),
			),
		).rejects.toBeDefined();

		if (scenario.previous) {
			expect(new Uint8Array(await readFile(output))).toEqual(bundledBytes);
			expect(JSON.parse(await readFile(signatureOutput, "utf8"))).toEqual(oldSignature);
		} else {
			await expect(access(output)).rejects.toBeDefined();
			await expect(access(signatureOutput)).rejects.toBeDefined();
		}
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
				if (!oldPath.endsWith(".pending")) return renameFx;
				renameEntered.resolve();
				return Effect.promise(() => releaseRename.promise).pipe(Effect.andThen(renameFx));
			},
		} satisfies FileSystem.FileSystem;
		const catalog = await createCatalog(root, fileSystem);

		const installing = Effect.runPromise(
			catalog.installFx({
				packageId,
				bytes: userBytes,
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
});
