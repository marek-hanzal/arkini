import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, FileSystem, Option, PlatformError } from "effect";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

const helper = join(import.meta.dirname, "FilesystemWrite.test", "lock-holder.ts");
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
			one.replaceFileFx({
				lock,
				target: first,
				bytes: encoder.encode("first"),
			}),
		);
		await Effect.runPromise(Deferred.await(firstEntered));
		const sameWrite = Effect.runPromise(
			two.replaceFileFx({
				lock,
				target: same,
				bytes: encoder.encode("same"),
			}),
		);
		await expect(
			Effect.runPromise(
				three.replaceFileFx({
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

	it("keeps the old file until one synced rename publishes the new file", async () => {
		const target = join(root, "target.json");
		await writeFile(target, "old");
		const nodeFileSystem = await readNodeFileSystem();
		const canonicalRoot = await Effect.runPromise(nodeFileSystem.realPath(root));
		const canonicalTarget = join(canonicalRoot, "target.json");
		const pending = `${canonicalTarget}.arkini-replace`;
		let rejectRename = true;
		let synced = false;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			open: (candidate, options) =>
				nodeFileSystem.open(candidate, options).pipe(
					Effect.map((file) =>
						String(candidate) === pending
							? new Proxy(file, {
									get(target, property, receiver) {
										if (property !== "sync")
											return Reflect.get(target, property, receiver);
										return file.sync.pipe(
											Effect.tap(() =>
												Effect.sync(() => {
													synced = true;
												}),
											),
										);
									},
								})
							: file,
					),
				),
			rename: (from, to) =>
				String(to) === canonicalTarget && rejectRename
					? Effect.fail(systemError("rename"))
					: nodeFileSystem.rename(from, to),
		};
		const filesystemWrite = await createWrite(fileSystem);
		const replace = () =>
			Effect.runPromise(
				filesystemWrite.replaceFileFx({
					lock: join(root, ".target.lock"),
					target,
					bytes: encoder.encode("new"),
				}),
			);

		await expect(replace()).rejects.toThrow("replacement failed");
		expect(synced).toBe(true);
		await expect(readFile(target, "utf8")).resolves.toBe("old");
		await expect(lstat(pending)).rejects.toMatchObject({
			code: "ENOENT",
		});

		rejectRename = false;
		synced = false;
		await expect(replace()).resolves.toBeUndefined();
		expect(synced).toBe(true);
		await expect(readFile(target, "utf8")).resolves.toBe("new");
		await expect(lstat(pending)).rejects.toMatchObject({
			code: "ENOENT",
		});
		await expect(lstat(join(canonicalRoot, ".target.lock.write"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("bounds independent replacements under one held lock", async () => {
		const nodeFileSystem = await readNodeFileSystem();
		const fourEntered = Effect.runSync(Deferred.make<void>());
		const releaseWrites = Effect.runSync(Deferred.make<void>());
		let active = 0;
		let entered = 0;
		let maximumActive = 0;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) =>
				String(to).endsWith(".json")
					? Effect.gen(function* () {
							active += 1;
							entered += 1;
							maximumActive = Math.max(maximumActive, active);
							if (entered === 4) yield* Deferred.succeed(fourEntered, undefined);
							yield* Deferred.await(releaseWrites);
							yield* nodeFileSystem.rename(from, to);
						}).pipe(
							Effect.ensuring(
								Effect.sync(() => {
									active -= 1;
								}),
							),
						)
					: nodeFileSystem.rename(from, to),
		};
		const filesystemWrite = await createWrite(fileSystem);
		const files = Array.from(
			{
				length: 5,
			},
			(_unused, index) => ({
				target: join(root, `${index}.json`),
				bytes: encoder.encode(String(index)),
			}),
		);
		const write = Effect.runPromise(
			filesystemWrite.replaceIndependentFilesFx({
				lock: join(root, ".batch.lock"),
				files,
				concurrency: 4,
			}),
		);

		await Effect.runPromise(Deferred.await(fourEntered));
		expect(entered).toBe(4);
		expect(maximumActive).toBe(4);
		Effect.runSync(Deferred.succeed(releaseWrites, undefined));
		await write;

		expect(entered).toBe(5);
		expect(maximumActive).toBe(4);
		await expect(
			Promise.all(files.map(({ target }) => readFile(target, "utf8"))),
		).resolves.toEqual([
			"0",
			"1",
			"2",
			"3",
			"4",
		]);
	});

	it("waits for a live CLI process using the same lock", async () => {
		const child = spawn(process.execPath, [
			tsx,
			helper,
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
	it("rejects external and non-file targets without recursive cleanup", async () => {
		const outside = await mkdtemp(join(tmpdir(), "arkini-filesystem-external-"));
		const outsideFile = join(outside, "outside.json");
		const directory = join(root, "owned-directory");
		const child = join(directory, "preserved.json");
		try {
			await writeFile(outsideFile, "outside");
			await mkdir(directory);
			await writeFile(child, "preserved");
			const filesystemWrite = await createWrite();
			await expect(
				Effect.runPromise(
					filesystemWrite.replaceFileFx({
						lock: join(root, ".owned.lock"),
						target: outsideFile,
						bytes: encoder.encode("replacement"),
					}),
				),
			).rejects.toThrow("is outside");
			await expect(
				Effect.runPromise(
					filesystemWrite.removeFileFx({
						lock: join(root, ".owned.lock"),
						target: directory,
					}),
				),
			).rejects.toThrow("must be a file");
			await expect(readFile(outsideFile, "utf8")).resolves.toBe("outside");
			await expect(readFile(child, "utf8")).resolves.toBe("preserved");
		} finally {
			await rm(outside, {
				force: true,
				recursive: true,
			});
		}
	});

	it("does not create missing parents while removing an absent exact file", async () => {
		const parent = join(root, "missing");
		const filesystemWrite = await createWrite();
		await expect(
			Effect.runPromise(
				filesystemWrite.removeFileFx({
					lock: join(root, ".owned.lock"),
					target: join(parent, "child.json"),
				}),
			),
		).resolves.toBeUndefined();
		await expect(lstat(parent)).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
