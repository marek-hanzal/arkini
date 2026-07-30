import { FileSystem } from "effect";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import type { EditorProjectRecord } from "../../contract/editor/EditorProjectRecord";
import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectFilePathFx } from "./assertEditorProjectFilePathFx";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";

export namespace createEditorProjectFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly record: EditorProjectRecord;
	}
}

/** Atomically publishes one complete project and never overwrites an existing workspace. */
export const createEditorProjectFx = Effect.fn("createEditorProjectFx")(function* ({
	root,
	fileSystem,
	record,
}: createEditorProjectFx.Props) {
	const projectId = yield* assertEditorProjectIdFx(record.projectId);
	const target = join(root, projectId);
	if (yield* fileSystem.exists(target)) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Create Arkini editor project",
				cause: new Error(`Editor project ${projectId} already exists.`),
			}),
		);
	}
	const seen = new Set<string>();
	const files = yield* Effect.forEach(record.files, (file) =>
		assertEditorProjectFilePathFx(file.path).pipe(
			Effect.flatMap((path) => {
				if (seen.has(path)) {
					return Effect.fail(
						new ElectronMainError({
							operation: "Create Arkini editor project",
							cause: new Error(`Duplicate editor project path ${path}.`),
						}),
					);
				}
				seen.add(path);
				return Effect.succeed({
					path,
					bytes: file.bytes,
				});
			}),
		),
	);
	if (files.length === 0) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Create Arkini editor project",
				cause: new Error("An editor project must contain at least one source file."),
			}),
		);
	}
	const pending = join(root, `.${projectId}.${randomUUID()}.pending`);
	yield* fileSystem.makeDirectory(root, {
		recursive: true,
	});
	yield* Effect.gen(function* () {
		yield* fileSystem.makeDirectory(pending);
		for (const file of files) {
			const path = join(pending, ...file.path.split("/"));
			yield* fileSystem.makeDirectory(dirname(path), {
				recursive: true,
			});
			yield* fileSystem.writeFile(path, file.bytes);
		}
		yield* fileSystem.rename(pending, target);
	}).pipe(
		Effect.onExit(() =>
			fileSystem.remove(pending, {
				recursive: true,
				force: true,
			}),
		),
	);
});
