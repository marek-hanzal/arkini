import { FileSystem } from "effect";
import { Effect } from "effect";

import { createProjectPathsFx } from "~/project-authoring/filesystem/createProjectPathsFx";
import { readProjectFilesFx } from "~/project-authoring/filesystem/fx/readProjectFilesFx";
import { readSidecarsFx } from "~/project-authoring/filesystem/fx/readSidecarsFx";
import { readVersionHistoryFx } from "~/project-authoring/filesystem/fx/readVersionHistoryFx";

/** Opens one complete portable Editor project with the production filesystem readers. */
export const readEditorJsonExportFx = Effect.fn("readEditorJsonExportFx")(function* (root: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const paths = yield* createProjectPathsFx(root);
	const project = yield* readProjectFilesFx(root);
	yield* readSidecarsFx({
		paths,
		projectId: project.config.meta.id,
	});
	yield* readVersionHistoryFx(paths);
	return {
		files: yield* fileSystem.readDirectory(root, {
			recursive: true,
		}),
		project,
	};
});
