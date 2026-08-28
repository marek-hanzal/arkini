import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { createEditorJsonExportDirectoryFx } from "../../../electron/main/editor-project/createEditorJsonExportDirectoryFx";
import {
	filesystemFailure,
	readReimportableProjectFx,
	readSortedDirectoryFx,
	writeExportSourceExtrasFx,
	writeReimportableProjectFx,
} from "./createEditorJsonExportDirectoryFx.test/harness";

describe("createEditorJsonExportDirectoryFx", () => {
	it.effect("creates distinct verified allowlisted projects inside the selected folder", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const source = `${root}/source`;
			const parent = `${root}/destination`;
			yield* fileSystem.makeDirectory(parent);
			yield* fileSystem.writeFileString(`${parent}/keep.txt`, "ordinary parent content");
			yield* writeReimportableProjectFx(source, 2);
			yield* writeExportSourceExtrasFx(source);

			const first = yield* createEditorJsonExportDirectoryFx({
				directoryName: "project-one",
				parent,
				source,
			});
			const second = yield* createEditorJsonExportDirectoryFx({
				directoryName: "project-one",
				parent,
				source,
			});

			expect(first.root).not.toBe(second.root);
			expect(path.dirname(first.root)).toBe(yield* fileSystem.realPath(parent));
			expect(path.basename(first.root)).toMatch(/^project-one-json-.+$/u);
			expect((yield* readReimportableProjectFx(first.root)).marker.revision).toBe(2);
			expect((yield* readReimportableProjectFx(second.root)).marker.revision).toBe(2);
			expect(yield* fileSystem.readFileString(`${parent}/keep.txt`)).toBe(
				"ordinary parent content",
			);
			expect(yield* fileSystem.readFileString(`${first.root}/notes/note-one.json`)).toContain(
				"kept",
			);
			for (const excluded of [
				"build",
				"game.json.tmp",
				"unrelated.json",
				".gitignore",
			])
				expect(yield* fileSystem.exists(`${first.root}/${excluded}`)).toBe(false);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("removes only its new folder when an allowlisted copy fails", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const source = `${root}/source`;
			const parent = `${root}/destination`;
			yield* fileSystem.makeDirectory(parent);
			yield* fileSystem.writeFileString(`${parent}/keep.txt`, "keep");
			yield* writeReimportableProjectFx(source, 3);
			const failing: FileSystem.FileSystem = {
				...fileSystem,
				copyFile: (from, to) =>
					path.basename(String(from)) === "game.json"
						? Effect.fail(filesystemFailure("copyFile"))
						: fileSystem.copyFile(from, to),
			};

			const result = yield* Effect.result(
				createEditorJsonExportDirectoryFx({
					directoryName: "project-one",
					parent,
					source,
				}).pipe(Effect.provideService(FileSystem.FileSystem, failing)),
			);

			expect(result._tag).toBe("Failure");
			expect(yield* readSortedDirectoryFx(parent)).toEqual([
				"keep.txt",
			]);
			expect((yield* readReimportableProjectFx(source)).marker.revision).toBe(3);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("does not retain an export that the production readers cannot reopen", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const source = `${root}/source`;
			const parent = `${root}/destination`;
			yield* fileSystem.makeDirectory(parent);
			yield* writeReimportableProjectFx(source, 4);
			const failing: FileSystem.FileSystem = {
				...fileSystem,
				readFileString: (filePath, options) =>
					path.basename(String(filePath)) === "game.json" &&
					path.basename(path.dirname(String(filePath))).startsWith("project-one-json-")
						? Effect.fail(filesystemFailure("readFileString"))
						: fileSystem.readFileString(filePath, options),
			};

			const result = yield* Effect.result(
				createEditorJsonExportDirectoryFx({
					directoryName: "project-one",
					parent,
					source,
				}).pipe(Effect.provideService(FileSystem.FileSystem, failing)),
			);

			expect(result._tag).toBe("Failure");
			expect(yield* readSortedDirectoryFx(parent)).toEqual([]);
			expect((yield* readReimportableProjectFx(source)).marker.revision).toBe(4);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("refuses to create its owned export inside the source project", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const source = `${yield* fileSystem.makeTempDirectoryScoped()}/source`;
			yield* writeReimportableProjectFx(source, 5);

			const result = yield* Effect.result(
				createEditorJsonExportDirectoryFx({
					directoryName: "project-one",
					parent: source,
					source,
				}),
			);

			expect(result._tag).toBe("Failure");
			expect(
				(yield* fileSystem.readDirectory(source)).filter((entry) =>
					entry.startsWith("project-one-json-"),
				),
			).toEqual([]);
			expect((yield* readReimportableProjectFx(source)).marker.revision).toBe(5);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("cleans its owned folder when export work is interrupted", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const source = `${root}/source`;
			const parent = `${root}/destination`;
			yield* fileSystem.makeDirectory(parent);
			yield* fileSystem.writeFileString(`${parent}/keep.txt`, "keep");
			yield* writeReimportableProjectFx(source, 6);
			const childCreated = yield* Deferred.make<string>();
			const copyStarted = yield* Deferred.make<void>();
			const blocked: FileSystem.FileSystem = {
				...fileSystem,
				makeTempDirectory: (options) =>
					fileSystem
						.makeTempDirectory(options)
						.pipe(Effect.tap((target) => Deferred.succeed(childCreated, target))),
				copyFile: () =>
					Deferred.succeed(copyStarted, undefined).pipe(Effect.andThen(Effect.never)),
			};
			const exporting = yield* createEditorJsonExportDirectoryFx({
				directoryName: "project-one",
				parent,
				source,
			}).pipe(Effect.provideService(FileSystem.FileSystem, blocked), Effect.forkChild);
			const child = yield* Deferred.await(childCreated);
			yield* Deferred.await(copyStarted);

			yield* Fiber.interrupt(exporting);

			expect(yield* fileSystem.exists(child)).toBe(false);
			expect(yield* readSortedDirectoryFx(parent)).toEqual([
				"keep.txt",
			]);
			expect((yield* readReimportableProjectFx(source)).marker.revision).toBe(6);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("does not interpret a POSIX backslash as a portable path separator", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			if (path.sep !== "/") return;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const source = `${root}/source`;
			const parent = `${root}/destination`;
			yield* fileSystem.makeDirectory(parent);
			yield* writeReimportableProjectFx(source, 7);
			yield* fileSystem.writeFileString(`${source}/notes\\private.json`, "private");

			const exported = yield* createEditorJsonExportDirectoryFx({
				directoryName: "project-one",
				parent,
				source,
			});

			expect(yield* fileSystem.exists(`${exported.root}/notes\\private.json`)).toBe(false);
			expect((yield* readReimportableProjectFx(exported.root)).marker.revision).toBe(7);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
