import { FileSystem } from "effect";
import { Effect } from "effect";
import { join, relative, sep } from "node:path";

import type { EditorProjectRecord } from "../../contract/editor/EditorProjectRecord";
import { assertEditorProjectFilePathFx } from "./assertEditorProjectFilePathFx";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";

export namespace readEditorProjectFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly projectId: string;
	}
}

/** Reads one contained project snapshot without exposing arbitrary filesystem paths. */
export const readEditorProjectFx = Effect.fn("readEditorProjectFx")(function* ({
	root,
	fileSystem,
	projectId: candidate,
}: readEditorProjectFx.Props) {
	const projectId = yield* assertEditorProjectIdFx(candidate);
	const projectRoot = join(root, projectId);
	if (!(yield* fileSystem.exists(projectRoot))) return null;
	const entries = (yield* fileSystem.readDirectory(projectRoot, {
		recursive: true,
	}))
		.map((entry) => join(projectRoot, entry))
		.filter((path) => path.endsWith(".json") || path.endsWith(".png"))
		.sort();
	const files = yield* Effect.forEach(entries, (path) => {
		const portablePath = relative(projectRoot, path).split(sep).join("/");
		return assertEditorProjectFilePathFx(portablePath).pipe(
			Effect.flatMap((validatedPath) =>
				fileSystem.readFile(path).pipe(
					Effect.map((bytes) => ({
						path: validatedPath,
						bytes,
					})),
				),
			),
		);
	});
	return {
		projectId,
		files,
	} satisfies EditorProjectRecord;
});
