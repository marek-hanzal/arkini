import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";

import {
	EditorProjectCreateSchema,
	type EditorProjectRecord,
} from "../../contract/editor/EditorProjectRecord";
import { EditorProjectWriteSchema } from "../../contract/editor/EditorProjectWrite";

import { ElectronMainError } from "../ElectronMainError";
import type { EditorWorkspace } from "./EditorWorkspace";
import { createEditorProjectFx } from "./createEditorProjectFx";
import { listEditorProjectsFx } from "./listEditorProjectsFx";
import { openEditorDirectoryFx } from "./openEditorDirectoryFx";
import { readEditorProjectFx } from "./readEditorProjectFx";
import { readEditorProjectRevisionFx } from "./readEditorProjectRevisionFx";
import { writeEditorProjectFx } from "./writeEditorProjectFx";

export namespace createFilesystemEditorWorkspaceFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates the serialized Electron filesystem authority for editor projects. */
export const createFilesystemEditorWorkspaceFx = Effect.fn("createFilesystemEditorWorkspaceFx")(
	function* ({ root, fileSystem: providedFileSystem }: createFilesystemEditorWorkspaceFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const operations = yield* Semaphore.make(1);
		const projectIndex = new Map<string, EditorProjectRecord>();
		const listFx: EditorWorkspace["listFx"] = Effect.fn("FilesystemEditorWorkspace.listFx")(
			() =>
				operations.withPermits(1)(
					listEditorProjectsFx({
						root,
						fileSystem,
					}),
				),
		);
		const createFx: EditorWorkspace["createFx"] = Effect.fn(
			"FilesystemEditorWorkspace.createFx",
		)((candidate) =>
			operations.withPermits(1)(
				Effect.gen(function* () {
					const record = yield* Effect.try({
						try: () => EditorProjectCreateSchema.parse(candidate),
						catch: (cause) =>
							new ElectronMainError({
								operation: "Create Arkini editor project",
								cause,
							}),
					});
					yield* createEditorProjectFx({
						root,
						fileSystem,
						record,
					});
					projectIndex.set(record.projectId, {
						...record,
						revision: yield* readEditorProjectRevisionFx({
							projectId: record.projectId,
							files: record.files,
						}),
					});
				}),
			),
		);
		const readFx: EditorWorkspace["readFx"] = Effect.fn("FilesystemEditorWorkspace.readFx")(
			(projectId) =>
				operations.withPermits(1)(
					readEditorProjectFx({
						root,
						fileSystem,
						projectId,
					}).pipe(
						Effect.tap((record) =>
							Effect.sync(() => {
								if (record === null) projectIndex.delete(projectId);
								else projectIndex.set(projectId, record);
							}),
						),
					),
				),
		);
		const writeFx: EditorWorkspace["writeFx"] = Effect.fn("FilesystemEditorWorkspace.writeFx")(
			(candidate) =>
				operations.withPermits(1)(
					Effect.gen(function* () {
						const mutation = yield* Effect.try({
							try: () => EditorProjectWriteSchema.parse(candidate),
							catch: (cause) =>
								new ElectronMainError({
									operation: "Write Arkini editor project",
									cause,
								}),
						});
						const record = projectIndex.get(mutation.projectId);
						if (record === undefined) {
							return yield* Effect.fail(
								new ElectronMainError({
									operation: "Write Arkini editor project",
									cause: new Error(
										`Editor project ${mutation.projectId} must be loaded before it can be written.`,
									),
								}),
							);
						}
						const result = yield* writeEditorProjectFx({
							root,
							fileSystem,
							mutation,
							record,
						});
						projectIndex.set(mutation.projectId, result.record);
						return result.write;
					}),
				),
		);
		const openDirectoryFx: EditorWorkspace["openDirectoryFx"] = Effect.fn(
			"FilesystemEditorWorkspace.openDirectoryFx",
		)((projectId) =>
			operations.withPermits(1)(
				openEditorDirectoryFx({
					root,
					fileSystem,
					...(projectId === undefined
						? {}
						: {
								projectId,
							}),
				}),
			),
		);
		return {
			listFx,
			createFx,
			readFx,
			writeFx,
			openDirectoryFx,
		} satisfies EditorWorkspace;
	},
);
