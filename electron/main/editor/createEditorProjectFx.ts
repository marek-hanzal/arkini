import { FileSystem } from "effect";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import {
	EditorProjectRecordSchema,
	type EditorProjectRecord,
} from "../../contract/editor/EditorProjectRecord";
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
	const parsedRecord = yield* Effect.try({
		try: () => EditorProjectRecordSchema.parse(record),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Create Arkini editor project",
				cause,
			}),
	});
	const projectId = yield* assertEditorProjectIdFx(parsedRecord.projectId);
	yield* fileSystem.makeDirectory(root, {
		recursive: true,
	});
	const existingProject = (yield* fileSystem.readDirectory(root)).find(
		(entry) => entry.toLowerCase() === projectId.toLowerCase(),
	);
	if (existingProject !== undefined) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Create Arkini editor project",
				cause: new Error(`Editor project ${existingProject} already exists.`),
			}),
		);
	}
	const target = join(root, projectId);
	const seen = new Set<string>();
	const files = yield* Effect.forEach(parsedRecord.files, (file) =>
		assertEditorProjectFilePathFx(file.path).pipe(
			Effect.flatMap((path) => {
				const collisionKey = path.toLowerCase();
				if (seen.has(collisionKey)) {
					return Effect.fail(
						new ElectronMainError({
							operation: "Create Arkini editor project",
							cause: new Error(`Duplicate editor project path ${path}.`),
						}),
					);
				}
				seen.add(collisionKey);
				return Effect.succeed({
					path,
					bytes: file.bytes,
				});
			}),
		),
	);
	const pending = join(root, `.${projectId}.${randomUUID()}.pending`);
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
