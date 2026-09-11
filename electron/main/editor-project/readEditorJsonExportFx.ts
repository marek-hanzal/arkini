import { FileSystem } from "effect";
import { Effect } from "effect";

import { createProjectPathsFx } from "~/project-authoring/filesystem/createProjectPathsFx";
import { readProjectFilesFx } from "~/project-authoring/filesystem/fx/readProjectFilesFx";
import { readProjectNotesFx } from "~/project-authoring/filesystem/fx/readProjectNotesFx";

/** Opens one complete portable Editor project with the production filesystem readers. */
export const readEditorJsonExportFx = Effect.fn("readEditorJsonExportFx")(function* (root: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const paths = yield* createProjectPathsFx(root);
	const project = yield* readProjectFilesFx(root);
	yield* readProjectNotesFx({
		paths,
		projectId: project.config.meta.id,
	});
	return {
		files: yield* fileSystem.readDirectory(root, {
			recursive: true,
		}),
		project,
	};
});
