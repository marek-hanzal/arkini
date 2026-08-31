import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { join } from "node:path";

import { withProjectLockFx } from "../../../../../electron/main/editor-project/filesystem/fx/withProjectLockFx";
import { writeProjectFileSetFx } from "../../../../../electron/main/editor-project/filesystem/fx/writeProjectFileSetFx";
import { createFilesystemWriteFx } from "../../../../../src/filesystem-write/fx/createFilesystemWriteFx";

const [mode, root] = process.argv.slice(2);
if (mode === undefined || root === undefined) throw new Error("Expected a mode and root.");

await Effect.runPromise(
	Effect.gen(function* () {
		const nodeFileSystem = yield* FileSystem.FileSystem;
		const targetRoot = mode === "nested-partial" ? join(root, "nested", "child") : root;
		const first = join(targetRoot, "first.json");
		const second = join(targetRoot, "second.json");
		const third = join(targetRoot, "third.json");
		if (mode === "read") {
			const filesystemWrite = yield* createFilesystemWriteFx();
			const values = yield* withProjectLockFx(
				filesystemWrite,
				root,
				Effect.all([
					nodeFileSystem.readFileString(first),
					nodeFileSystem.readFileString(second),
				]),
			);
			process.stdout.write(JSON.stringify(values));
			return;
		}
		const canonicalRoot = yield* nodeFileSystem.realPath(root);
		const canonicalTargetRoot = yield* nodeFileSystem.realPath(targetRoot);
		const canonicalFirst = join(canonicalTargetRoot, "first.json");
		const canonicalThird = join(canonicalTargetRoot, "third.json");
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (oldPath, newPath) =>
				nodeFileSystem
					.rename(oldPath, newPath)
					.pipe(
						Effect.tap(() =>
							(mode === "partial" || mode === "nested-partial") &&
							String(newPath) === canonicalFirst
								? Effect.sync(() => process.kill(process.pid, "SIGKILL"))
								: Effect.void,
						),
					),
			open: (target, options) =>
				nodeFileSystem.open(target, options).pipe(
					Effect.map((file) =>
						(mode === "committed" &&
							String(target) ===
								join(canonicalRoot, "editor.lock.write", "committed")) ||
						(mode === "staged" && String(target) === `${canonicalThird}.arkini-replace`)
							? new Proxy(file, {
									get(proxyTarget, property, receiver) {
										if (property !== "sync")
											return Reflect.get(proxyTarget, property, receiver);
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
		yield* writeProjectFileSetFx({
			filesystemWrite,
			root,
			planFx: Effect.succeed({
				writes:
					mode === "staged"
						? [
								{
									target: third,
									bytes: new TextEncoder().encode("new-third"),
								},
							]
						: [
								{
									target: first,
									bytes: new TextEncoder().encode("new-first"),
								},
								{
									target: second,
									bytes: new TextEncoder().encode("new-second"),
								},
							],
			}),
		});
	}).pipe(Effect.provide(NodeServices.layer)),
);
