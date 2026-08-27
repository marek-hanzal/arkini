import { FileSystem } from "effect";
import { Effect } from "effect";

import { createEditorProjectFilesystemPathsFx } from "./filesystem/createEditorProjectFilesystemPathsFx";
import { readFilesystemEditorProjectFilesFx } from "./filesystem/fx/readFilesystemEditorProjectFilesFx";
import { readFilesystemEditorProjectSidecarsFx } from "./filesystem/fx/readFilesystemEditorProjectSidecarsFx";
import { readFilesystemEditorProjectVersionHistoryFx } from "./filesystem/fx/readFilesystemEditorProjectVersionHistoryFx";

/** Opens one complete portable Editor project with the production filesystem readers. */
export const readEditorJsonExportFx = Effect.fn("readEditorJsonExportFx")(function* (root: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const paths = yield* createEditorProjectFilesystemPathsFx(root);
	const project = yield* readFilesystemEditorProjectFilesFx(root);
	yield* readFilesystemEditorProjectSidecarsFx({
		paths,
		projectId: project.config.meta.id,
	});
	yield* readFilesystemEditorProjectVersionHistoryFx(paths);
	return {
		files: yield* fileSystem.readDirectory(root, {
			recursive: true,
		}),
		project,
	};
});
