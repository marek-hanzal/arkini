import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recoverArkpackArtifactPairFx } from "../../electron/main/arkpack/recoverArkpackArtifactPairFx";
import {
	bundledBytes,
	createCatalog,
	createNodeFileSystem,
	readRoots,
	readSignaturePath,
	userBytes,
	writePackage,
} from "./writeArkpackArtifactPairFx.test/fixture";

const signature = (byte: number) => btoa(String.fromCharCode(...new Uint8Array(64).fill(byte)));
let root = "";

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "arkini-arkpack-recovery-")));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("recoverArkpackArtifactPairFx", () => {
	it("restores an interrupted pair before the user catalog exposes it", async () => {
		const packageId = "crash-recovery";
		const roots = readRoots(root);
		const arkpackPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: bundledBytes,
			signature: signature(1),
		});
		const signaturePath = readSignaturePath(roots.user, packageId);
		const transaction = join(roots.user, `.${packageId}.arkpack.transaction`);
		await mkdir(transaction);
		await Promise.all([
			writeFile(join(transaction, "previous.arkpack"), bundledBytes),
			writeFile(join(transaction, "previous.arksig"), `${signature(1)}\n`),
			writeFile(join(transaction, "had-arkpack"), ""),
			writeFile(join(transaction, "had-signature"), ""),
			writeFile(join(transaction, "ready"), ""),
			writeFile(signaturePath, `${signature(2)}\n`),
		]);

		const catalog = await createCatalog(root);
		await Effect.runPromise(catalog.listFx);

		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(bundledBytes);
		expect((await readFile(signaturePath, "utf8")).trim()).toBe(signature(1));
		await expect(access(transaction)).rejects.toBeDefined();
	});

	it("fails closed when a ready journal is missing a required backup", async () => {
		const packageId = "incomplete-recovery";
		const roots = readRoots(root);
		const arkpackPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: userBytes,
			signature: signature(2),
		});
		const transaction = join(roots.user, `.${packageId}.arkpack.transaction`);
		await mkdir(transaction);
		await Promise.all([
			writeFile(join(transaction, "previous.arkpack"), bundledBytes),
			writeFile(join(transaction, "had-arkpack"), "1"),
			writeFile(join(transaction, "had-signature"), "1"),
			writeFile(join(transaction, "ready"), "1"),
		]);
		const catalog = await createCatalog(root);

		await expect(Effect.runPromise(catalog.listFx)).rejects.toBeDefined();
		await expect(access(transaction)).resolves.toBeUndefined();
		await expect(access(arkpackPath)).resolves.toBeUndefined();
	});

	it("rejects a symlinked journal without touching its outside target", async () => {
		const packageId = "symlinked-recovery";
		const roots = readRoots(root);
		const arkpackPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: userBytes,
		});
		const outside = join(root, "outside-journal");
		const transaction = join(roots.user, `.${packageId}.arkpack.transaction`);
		await mkdir(outside);
		await Promise.all([
			writeFile(join(outside, "ready"), "1"),
			writeFile(join(outside, "sentinel.txt"), "keep"),
		]);
		await symlink(outside, transaction, "dir");
		const fileSystem = await createNodeFileSystem();

		await expect(
			Effect.runPromise(
				recoverArkpackArtifactPairFx({
					arkpackPath,
					fileSystem,
				}),
			),
		).rejects.toThrow("is not canonical");
		await expect(readFile(join(outside, "sentinel.txt"), "utf8")).resolves.toBe("keep");
	});

	it("finishes cleanup without reinterpreting a restored journal", async () => {
		const packageId = "repeat-recovery";
		const roots = readRoots(root);
		const arkpackPath = await writePackage({
			root: roots.user,
			packageId,
			bytes: userBytes,
		});
		const transaction = join(roots.user, `.${packageId}.arkpack.transaction`);
		const cleanup = `${transaction}.cleanup`;
		await mkdir(transaction);
		await Promise.all([
			writeFile(join(transaction, "previous.arkpack"), bundledBytes),
			writeFile(join(transaction, "had-arkpack"), "1"),
			writeFile(join(transaction, "ready"), "1"),
		]);
		const nodeFileSystem = await createNodeFileSystem();
		let cleanupFailed = false;
		const interruptedFileSystem = {
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
				recoverArkpackArtifactPairFx({
					arkpackPath,
					fileSystem: interruptedFileSystem,
				}),
			),
		).rejects.toBeDefined();
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(bundledBytes);
		await expect(access(join(cleanup, "previous.arkpack"))).resolves.toBeUndefined();

		await Effect.runPromise(
			recoverArkpackArtifactPairFx({
				arkpackPath,
				fileSystem: nodeFileSystem,
			}),
		);
		expect(new Uint8Array(await readFile(arkpackPath))).toEqual(bundledBytes);
		await expect(access(cleanup)).rejects.toBeDefined();
	});
});
