import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, FileSystem, Option, PlatformError } from "effect";
import { execFile, spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFilesystemWriteFx } from "../../../src/engine/filesystem/createFilesystemWriteFx";

const runFile = promisify(execFile);
const helper = join(import.meta.dirname, "FilesystemWrite.test", "crash.ts");
const tsx = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const encoder = new TextEncoder();
let root = "";

const systemError = (method: string) =>
	PlatformError.systemError({
		_tag: "Unknown",
		module: "FileSystem",
		method,
		description: `${method} failed`,
	});

const createWrite = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		fileSystem === undefined
			? createFilesystemWriteFx().pipe(Effect.provide(NodeServices.layer))
			: createFilesystemWriteFx().pipe(
					Effect.provide(NodePath.layer),
					Effect.provideService(FileSystem.FileSystem, fileSystem),
				),
	);

const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

const expectFreshProcessStateAfterCrash = async (
	mode: "committed" | "partial",
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
	root = await mkdtemp(join(tmpdir(), "arkini-filesystem-write-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("FilesystemWrite", () => {
	it("serializes distinct instances by canonical lock while other locks proceed", async () => {
		const nodeFileSystem = await readNodeFileSystem();
		const firstEntered = Effect.runSync(Deferred.make<void>());
		const releaseFirst = Effect.runSync(Deferred.make<void>());
		const sameEntered = Effect.runSync(Deferred.make<void>());
		const first = join(root, "first");
		const same = join(root, "same");
		const other = join(root, "other");
		const canonicalRoot = await Effect.runPromise(nodeFileSystem.realPath(root));
		const canonicalFirst = join(canonicalRoot, "first");
		const canonicalSame = join(canonicalRoot, "same");
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (oldPath, newPath) => {
				if (String(newPath) === canonicalFirst)
					return Deferred.succeed(firstEntered, undefined).pipe(
						Effect.andThen(Deferred.await(releaseFirst)),
						Effect.andThen(nodeFileSystem.rename(oldPath, newPath)),
					);
				if (String(newPath) === canonicalSame)
					return Deferred.succeed(sameEntered, undefined).pipe(
						Effect.andThen(nodeFileSystem.rename(oldPath, newPath)),
					);
				return nodeFileSystem.rename(oldPath, newPath);
			},
		};
		const [one, two, three] = await Promise.all([
			createWrite(fileSystem),
			createWrite(fileSystem),
			createWrite(fileSystem),
		]);
		const lock = join(root, ".shared.lock");
		const firstWrite = Effect.runPromise(
			one.writeFileFx({
				lock,
				target: first,
				bytes: encoder.encode("first"),
			}),
		);
		await Effect.runPromise(Deferred.await(firstEntered));
		const sameWrite = Effect.runPromise(
			two.writeFileFx({
				lock,
				target: same,
				bytes: encoder.encode("same"),
			}),
		);
		await expect(
			Effect.runPromise(
				three.writeFileFx({
					lock: join(root, ".other.lock"),
					target: other,
					bytes: encoder.encode("other"),
				}),
			),
		).resolves.toBeUndefined();
		expect(Option.isNone(await Effect.runPromise(Deferred.poll(sameEntered)))).toBe(true);
		Effect.runSync(Deferred.succeed(releaseFirst, undefined));
		await Promise.all([
			firstWrite,
			sameWrite,
		]);
	});

	it("waits for a live CLI process using the same lock", async () => {
		const child = spawn(process.execPath, [
			tsx,
			helper,
			"hold",
			root,
		]);
		let stderr = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => (stderr += chunk));
		const exited = new Promise<void>((resolve, reject) => {
			child.once("error", reject);
			child.once("exit", (code) =>
				code === 0
					? resolve()
					: reject(new Error(stderr || `Lock holder exited with ${code}.`)),
			);
		});
		await new Promise<void>((resolve, reject) => {
			child.stdout.setEncoding("utf8");
			child.stdout.once("data", (chunk: string) =>
				chunk.includes("locked")
					? resolve()
					: reject(new Error(`Unexpected output: ${chunk}`)),
			);
			exited.catch(reject);
		});
		const filesystemWrite = await createWrite();
		const contender = Effect.runPromise(
			filesystemWrite.withLockFx(join(root, ".write.lock"), Effect.void),
		);
		const enteredBeforeRelease = await Promise.race([
			contender.then(() => true),
			new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
		]);
		expect(enteredBeforeRelease).toBe(false);
		await exited;
		await expect(contender).resolves.toBeUndefined();
	});

	it("releases a lock after failure and interruption", async () => {
		const one = await createWrite();
		const two = await createWrite();
		const lock = join(root, ".release.lock");
		await expect(Effect.runPromise(one.withLockFx(lock, Effect.fail("failed")))).rejects.toBe(
			"failed",
		);
		const entered = Effect.runSync(Deferred.make<void>());
		const held = await Effect.runPromise(
			one
				.withLockFx(
					lock,
					Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
				)
				.pipe(Effect.forkDetach),
		);
		await Effect.runPromise(Deferred.await(entered));
		await Effect.runPromise(Fiber.interrupt(held));
		await expect(Effect.runPromise(two.withLockFx(lock, Effect.void))).resolves.toBeUndefined();

		const nestedEntered = Effect.runSync(Deferred.make<void>());
		const nested = await Effect.runPromise(
			one.withLockFx(
				lock,
				Effect.gen(function* () {
					const fiber = yield* two
						.withLockFx(lock, Deferred.succeed(nestedEntered, undefined))
						.pipe(Effect.forkDetach);
					yield* Effect.sleep("50 millis");
					return {
						entered: Option.isSome(yield* Deferred.poll(nestedEntered)),
						fiber,
					};
				}),
			),
		);
		expect(nested.entered).toBe(false);
		await Effect.runPromise(Deferred.await(nestedEntered));
		await Effect.runPromise(Fiber.await(nested.fiber));
	});

	it("rejects a symbolic-link target without touching its referent", async () => {
		const outside = join(root, "outside");
		const target = join(root, "target");
		await writeFile(outside, "outside");
		await symlink(outside, target);
		const filesystemWrite = await createWrite();
		await expect(
			Effect.runPromise(
				filesystemWrite.writeFileFx({
					lock: join(root, ".symlink.lock"),
					target,
					bytes: encoder.encode("replaced"),
				}),
			),
		).rejects.toThrow("must not be a symbolic link");
		await expect(readFile(outside, "utf8")).resolves.toBe("outside");
	});

	it("reopens the old file set after a process crashes during replacement", async () => {
		await expectFreshProcessStateAfterCrash("partial", [
			"old-first",
			"old-second",
		]);
	}, 12_000);

	it("reopens the committed file set after a process crashes during cleanup", async () => {
		await expectFreshProcessStateAfterCrash("committed", [
			"new-first",
			"new-second",
		]);
	}, 12_000);

	it("refuses recovery through a replaced parent symlink", async () => {
		const nested = join(root, "nested");
		const nestedChild = join(nested, "child");
		const outside = await mkdtemp(join(tmpdir(), "arkini-filesystem-outside-"));
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
				Effect.runPromise(
					filesystemWrite.withLockFx(join(root, ".write.lock"), Effect.void),
				),
			).rejects.toThrow("is unsafe");
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

	it("preserves the backup and reports its exact location when recovery fails", async () => {
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
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			copyFile: (from, to) =>
				basename(String(from)).startsWith("backup-") &&
				basename(String(to)).endsWith(".restore")
					? Effect.fail(systemError("copyFile"))
					: nodeFileSystem.copyFile(from, to),
		};
		const filesystemWrite = await createWrite(fileSystem);
		const recovery = join(
			await Effect.runPromise(nodeFileSystem.realPath(root)),
			".write.lock.write",
		);
		let failure: unknown;
		try {
			await Effect.runPromise(
				filesystemWrite.withLockFx(join(root, ".write.lock"), Effect.void),
			);
		} catch (cause) {
			failure = cause;
		}
		expect(failure).toMatchObject({
			recovery,
		});
		await expect(lstat(recovery)).resolves.toMatchObject({
			isDirectory: expect.any(Function),
		});
		await expect(readFile(join(recovery, "backup-0"), "utf8")).resolves.toBe("old-first");
	}, 12_000);
});
