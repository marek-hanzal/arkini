import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeArkpackArtifactPairFx } from "../../electron/main/arkpack/writeArkpackArtifactPairFx";
import {
	bundledBytes,
	createCatalog,
	createNodeFileSystem,
	createPromiseGate,
	readPackagePath,
	readRoots,
	readSignaturePath,
	userBytes,
	writePackage,
} from "./writeArkpackArtifactPairFx.test/fixture";

const signature = (byte: number) => btoa(String.fromCharCode(...new Uint8Array(64).fill(byte)));

let root = "";

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "arkini-arkpack-pair-")));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("writeArkpackArtifactPairFx", () => {
	it("restores the complete previous pair when publication fails", async () => {
		const packageId = "rollback-pair";
		const roots = readRoots(root);
		const arkpackPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: bundledBytes,
			signature: signature(1),
		});
		const signaturePath = readSignaturePath(roots.user, packageId);
		const nodeFileSystem = await createNodeFileSystem();
		const fileSystem = {
			...nodeFileSystem,
			rename: (from, to) =>
				from.endsWith("/pending.arkpack") && to === arkpackPath
					? nodeFileSystem.rename(join(root, "missing-publication"), to)
					: nodeFileSystem.rename(from, to),
		} satisfies FileSystem.FileSystem;

		await expect(
			Effect.runPromise(
				writeArkpackArtifactPairFx({
					arkpackPath,
					bytes: userBytes,
					fileSystem,
					signature: signature(2),
				}),
			),
		).rejects.toBeDefined();
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(bundledBytes);
		expect((await readFile(signaturePath, "utf8")).trim()).toBe(signature(1));
	});

	it("keeps a committed pair successful and lets the next scan finish cleanup", async () => {
		const packageId = "committed-pair";
		const roots = readRoots(root);
		const arkpackPath = readPackagePath(roots.user, packageId);
		const transaction = join(roots.user, `.${packageId}.arkpack.transaction`);
		const cleanup = `${transaction}.cleanup`;
		const nodeFileSystem = await createNodeFileSystem();
		let cleanupFailed = false;
		const fileSystem = {
			...nodeFileSystem,
			remove: (candidate, options) => {
				if (!cleanupFailed && candidate === cleanup) {
					cleanupFailed = true;
					return nodeFileSystem.remove(join(root, "missing-cleanup"));
				}
				return nodeFileSystem.remove(candidate, options);
			},
		} satisfies FileSystem.FileSystem;

		await expect(
			Effect.runPromise(
				writeArkpackArtifactPairFx({
					arkpackPath,
					bytes: userBytes,
					fileSystem,
				}),
			),
		).resolves.toBeUndefined();
		expect(cleanupFailed).toBe(true);

		const catalog = await createCatalog(root, fileSystem);
		await Effect.runPromise(catalog.listFx);
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(userBytes);
		await expect(access(transaction)).rejects.toBeDefined();
	});

	it("serializes concurrent writers for the same canonical pair", async () => {
		const roots = readRoots(root);
		const arkpackPath = readPackagePath(roots.user, "concurrent-pair");
		await mkdir(roots.user, {
			recursive: true,
		});
		await writeFile(join(roots.user, ".concurrent-pair.arkpack.lock"), "stale");
		const nodeFileSystem = await createNodeFileSystem();
		const firstPublication = createPromiseGate();
		const releaseFirst = createPromiseGate();
		let publicationCount = 0;
		const fileSystem = {
			...nodeFileSystem,
			rename: (from, to) => {
				const renameFx = nodeFileSystem.rename(from, to);
				if (!from.endsWith("/pending.arkpack") || to !== arkpackPath) return renameFx;
				publicationCount += 1;
				if (publicationCount !== 1) return renameFx;
				firstPublication.resolve();
				return Effect.promise(() => releaseFirst.promise).pipe(Effect.andThen(renameFx));
			},
		} satisfies FileSystem.FileSystem;
		const first = Effect.runPromise(
			writeArkpackArtifactPairFx({
				arkpackPath,
				bytes: userBytes,
				fileSystem,
			}),
		);
		await firstPublication.promise;
		const second = Effect.runPromise(
			writeArkpackArtifactPairFx({
				arkpackPath,
				bytes: bundledBytes,
				fileSystem,
			}),
		);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(publicationCount).toBe(1);
		releaseFirst.resolve();
		await Promise.all([
			first,
			second,
		]);
		expect(publicationCount).toBe(2);
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(bundledBytes);
	});
});
