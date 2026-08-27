import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { join } from "node:path";

import { createFilesystemWriteFx } from "../../../../src/engine/filesystem/createFilesystemWriteFx";

const [mode, root] = process.argv.slice(2);
if (mode === undefined || root === undefined) throw new Error("Expected a mode and root.");

const lock = join(root, ".write.lock");
const first = join(root, "first.json");
const second = join(root, "second.json");

await Effect.runPromise(
	Effect.gen(function* () {
		const nodeFileSystem = yield* FileSystem.FileSystem;
		if (mode === "read") {
			const filesystemWrite = yield* createFilesystemWriteFx();
			const values = yield* filesystemWrite.withLockFx(
				lock,
				Effect.all([
					nodeFileSystem.readFileString(first),
					nodeFileSystem.readFileString(second),
				]),
			);
			process.stdout.write(JSON.stringify(values));
			return;
		}
		if (mode === "hold") {
			const filesystemWrite = yield* createFilesystemWriteFx();
			yield* filesystemWrite.withLockFx(
				lock,
				Effect.sync(() => process.stdout.write("locked\n")).pipe(
					Effect.andThen(Effect.sleep("2 seconds")),
				),
			);
			return;
		}
		const canonicalRoot = yield* nodeFileSystem.realPath(root);
		const canonicalLock = join(canonicalRoot, ".write.lock");
		const canonicalFirst = join(canonicalRoot, "first.json");

		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (oldPath, newPath) =>
				nodeFileSystem
					.rename(oldPath, newPath)
					.pipe(
						Effect.tap(() =>
							mode === "partial" && String(newPath) === canonicalFirst
								? Effect.sync(() => process.kill(process.pid, "SIGKILL"))
								: Effect.void,
						),
					),
			open: (path, options) =>
				nodeFileSystem.open(path, options).pipe(
					Effect.map((file) =>
						mode === "committed" && String(path) === `${canonicalLock}.write/committed`
							? new Proxy(file, {
									get(target, property, receiver) {
										if (property !== "sync")
											return Reflect.get(target, property, receiver);
										return file.sync.pipe(
											Effect.tap(() =>
												Effect.sync(() =>
													process.kill(process.pid, "SIGKILL"),
												),
											),
										);
									},
								})
							: file,
					),
				),
		};
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provide(NodePath.layer),
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		yield* filesystemWrite.writeFilesFx({
			lock,
			root,
			writes: [
				{
					target: first,
					bytes: new TextEncoder().encode("new-first"),
				},
				{
					target: second,
					bytes: new TextEncoder().encode("new-second"),
				},
			],
		});
	}).pipe(Effect.provide(NodeServices.layer)),
);
