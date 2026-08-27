import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, FileSystem, Option, PlatformError } from "effect";
import { execFile } from "node:child_process";
import { lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFilesystemWriteFx } from "../../../src/engine/filesystem/createFilesystemWriteFx";

const runFile = promisify(execFile);
const helper = join(import.meta.dirname, "FilesystemWrite.test", "crash.ts");
const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
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
		const canonicalRoot = await realpath(root);
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

	it("rolls back when the target parent cannot be synced", async () => {
		const target = join(root, "value");
		await writeFile(target, "old");
		const canonicalRoot = await realpath(root);
		const canonicalTarget = join(canonicalRoot, "value");
		const nodeFileSystem = await readNodeFileSystem();
		let replaced = false;
		let failed = false;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (oldPath, newPath) =>
				nodeFileSystem
					.rename(oldPath, newPath)
					.pipe(
						Effect.tap(() =>
							Effect.sync(() => (replaced ||= String(newPath) === canonicalTarget)),
						),
					),
			open: (path, options) => {
				if (replaced && !failed && String(path) === canonicalRoot) {
					failed = true;
					return Effect.fail(systemError("open"));
				}
				return nodeFileSystem.open(path, options);
			},
		};
		const filesystemWrite = await createWrite(fileSystem);
		await expect(
			Effect.runPromise(
				filesystemWrite.writeFileFx({
					lock: join(root, ".durable.lock"),
					target,
					bytes: encoder.encode("new"),
				}),
			),
		).rejects.toBeDefined();
		await expect(readFile(target, "utf8")).resolves.toBe("old");
	});

	it("applies an explicit private mode", async () => {
		const target = join(root, "secret");
		const filesystemWrite = await createWrite();
		await Effect.runPromise(
			filesystemWrite.writeFileFx({
				lock: join(root, ".secret.lock"),
				target,
				bytes: encoder.encode("secret"),
				mode: 0o600,
			}),
		);
		expect((await lstat(target)).mode & 0o777).toBe(0o600);
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

	it("recovers fresh processes to exactly the old or committed file set", async () => {
		const first = join(root, "first.json");
		const second = join(root, "second.json");
		await Promise.all([
			writeFile(first, "old-first"),
			writeFile(second, "old-second"),
		]);
		await expect(
			runFile(tsx, [
				helper,
				"partial",
				root,
			]),
		).rejects.toBeDefined();
		const old = await runFile(tsx, [
			helper,
			"read",
			root,
		]);
		expect(JSON.parse(old.stdout)).toEqual([
			"old-first",
			"old-second",
		]);

		await expect(
			runFile(tsx, [
				helper,
				"committed",
				root,
			]),
		).rejects.toBeDefined();
		const committed = await runFile(tsx, [
			helper,
			"read",
			root,
		]);
		expect(JSON.parse(committed.stdout)).toEqual([
			"new-first",
			"new-second",
		]);
	});

	it("preserves the backup and reports its exact location when recovery fails", async () => {
		await Promise.all([
			writeFile(join(root, "first.json"), "old-first"),
			writeFile(join(root, "second.json"), "old-second"),
		]);
		await expect(
			runFile(tsx, [
				helper,
				"partial",
				root,
			]),
		).rejects.toBeDefined();
		const nodeFileSystem = await readNodeFileSystem();
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			copyFile: (from, to) =>
				String(from).includes(".write/backup-") && String(to).endsWith(".restore")
					? Effect.fail(systemError("copyFile"))
					: nodeFileSystem.copyFile(from, to),
		};
		const filesystemWrite = await createWrite(fileSystem);
		const recovery = `${await realpath(root)}/.write.lock.write`;
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
	});
});
