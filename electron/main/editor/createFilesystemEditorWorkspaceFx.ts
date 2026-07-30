import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";

import type { EditorWorkspace } from "./EditorWorkspace";
import { createEditorProjectFx } from "./createEditorProjectFx";
import { listEditorProjectsFx } from "./listEditorProjectsFx";
import { openEditorDirectoryFx } from "./openEditorDirectoryFx";
import { readEditorProjectFx } from "./readEditorProjectFx";

export namespace createFilesystemEditorWorkspaceFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates the serialized Electron filesystem authority for editor projects. */
export const createFilesystemEditorWorkspaceFx = Effect.fn(
	"createFilesystemEditorWorkspaceFx",
)(function* ({ root, fileSystem: providedFileSystem }: createFilesystemEditorWorkspaceFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const operations = yield* Semaphore.make(1);
	const listFx: EditorWorkspace["listFx"] = Effect.fn(
		"FilesystemEditorWorkspace.listFx",
	)(() =>
		operations.withPermits(1)(
			listEditorProjectsFx({
				root,
				fileSystem,
			}),
		),
	);
	const createFx: EditorWorkspace["createFx"] = Effect.fn(
		"FilesystemEditorWorkspace.createFx",
	)((record) =>
		operations.withPermits(1)(
			createEditorProjectFx({
				root,
				fileSystem,
				record,
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
				...(projectId === undefined ? {} : { projectId }),
			}),
		),
	);
	return {
		listFx,
		createFx,
		readFx,
		openDirectoryFx,
	} satisfies EditorWorkspace;
});
