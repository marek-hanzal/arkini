import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, PlatformError } from "effect";
import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { withProjectLockFx } from "~electron/main/editor-project/filesystem/fx/withProjectLockFx";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

const runFile = promisify(execFile);
const helper = join(import.meta.dirname, "ProjectFileTransaction.test", "crash.ts");
const tsx = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
let root = "";

const systemError = (method: string) =>
	PlatformError.systemError({
		_tag: "Unknown",
		module: "FileSystem",
		method,
		description: `${method} failed`,
	});

const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

const createWrite = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		fileSystem === undefined
			? createFilesystemWriteFx().pipe(Effect.provide(NodeServices.layer))
			: createFilesystemWriteFx().pipe(
					Effect.provide(NodePath.layer),
					Effect.provideService(FileSystem.FileSystem, fileSystem),
				),
	);

const expectFreshProcessStateAfterCrash = async (
	mode: "committed" | "partial" | "staged",
	expected: ReadonlyArray<string>,
) => {
	await Promise.all([
		writeFile(join(root, "first.json"), "old-first"),
		writeFile(join(root, "second.json"), "old-second"),
	]);
	await expect(
		runFile(process.execPath, [
			tsx,
			helper,
			mode,
			root,
		]),
	).rejects.toBeDefined();
	const reopened = await runFile(process.execPath, [
		tsx,
		helper,
		"read",
		root,
	]);
	expect(JSON.parse(reopened.stdout)).toEqual(expected);
};

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-project-transaction-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("Editor project file transaction", () => {
	it("reopens the old tree after a process crashes during replacement", async () => {
		await expectFreshProcessStateAfterCrash("partial", [
			"old-first",
			"old-second",
		]);
	}, 12_000);

	it("removes the exact staging file after a process crashes before rename", async () => {
		await expectFreshProcessStateAfterCrash("staged", [
			"old-first",
			"old-second",
		]);
		await expect(lstat(join(root, "third.json"))).rejects.toMatchObject({
			code: "ENOENT",
		});
		await expect(lstat(`${join(root, "third.json")}.arkini-replace`)).rejects.toMatchObject({
			code: "ENOENT",
		});
	}, 12_000);

	it("reopens the committed tree after a process crashes during cleanup", async () => {
		await expectFreshProcessStateAfterCrash("committed", [
			"new-first",
			"new-second",
		]);
	}, 12_000);

	it("refuses recovery through a replaced parent symlink", async () => {
		const nested = join(root, "nested");
		const nestedChild = join(nested, "child");
		const outside = await mkdtemp(join(tmpdir(), "arkini-project-transaction-outside-"));
		const outsideChild = join(outside, "child");
		try {
			await Promise.all([
				mkdir(nestedChild, {
					recursive: true,
				}),
				mkdir(outsideChild),
			]);
			await Promise.all([
				writeFile(join(nestedChild, "first.json"), "old-first"),
				writeFile(join(nestedChild, "second.json"), "old-second"),
				writeFile(join(outsideChild, "first.json"), "outside-first"),
				writeFile(join(outsideChild, "second.json"), "outside-second"),
			]);
			await expect(
				runFile(process.execPath, [
					tsx,
					helper,
					"nested-partial",
					root,
				]),
			).rejects.toBeDefined();
			await rename(nested, join(root, "nested-owned"));
			await symlink(outside, nested);

			const filesystemWrite = await createWrite();
			await expect(
				Effect.runPromise(withProjectLockFx(filesystemWrite, root, Effect.void)),
			).rejects.toThrow("preserved");
			await expect(readFile(join(outsideChild, "first.json"), "utf8")).resolves.toBe(
				"outside-first",
			);
			await expect(readFile(join(outsideChild, "second.json"), "utf8")).resolves.toBe(
				"outside-second",
			);
		} finally {
			await rm(outside, {
				force: true,
				recursive: true,
			});
		}
	}, 12_000);

	it("preserves the journal and reports its exact location when rollback fails", async () => {
		await Promise.all([
			writeFile(join(root, "first.json"), "old-first"),
			writeFile(join(root, "second.json"), "old-second"),
		]);
		await expect(
			runFile(process.execPath, [
				tsx,
				helper,
				"partial",
				root,
			]),
		).rejects.toBeDefined();
		const nodeFileSystem = await readNodeFileSystem();
		const canonicalRoot = await Effect.runPromise(nodeFileSystem.realPath(root));
		const failedStaging = `${join(canonicalRoot, "first.json")}.arkini-replace`;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			open: (target, options) =>
				String(target) === failedStaging
					? Effect.fail(systemError("open"))
					: nodeFileSystem.open(target, options),
		};
		const filesystemWrite = await createWrite(fileSystem);
		const recovery = join(canonicalRoot, "editor.lock.write");
		let failure: unknown;
		try {
			await Effect.runPromise(withProjectLockFx(filesystemWrite, root, Effect.void));
		} catch (cause) {
			failure = cause;
		}
		expect(failure).toMatchObject({
			recovery,
		});
		await expect(lstat(recovery)).resolves.toMatchObject({
			isDirectory: expect.any(Function),
		});
		await expect(readFile(join(recovery, "old-0"), "utf8")).resolves.toBe("old-first");
	}, 12_000);

	it("never recursively removes an unowned journal-shaped directory", async () => {
		const active = join(root, "editor.lock.write");
		const child = join(active, "unowned", "preserved.json");
		await mkdir(join(active, "unowned"), {
			recursive: true,
		});
		await writeFile(child, "preserved");
		const filesystemWrite = await createWrite();
		await expect(
			Effect.runPromise(withProjectLockFx(filesystemWrite, root, Effect.void)),
		).rejects.toThrow("missing");
		await expect(readFile(child, "utf8")).resolves.toBe("preserved");
	});
});
