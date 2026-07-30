import { FileSystem } from "effect";
import { Effect } from "effect";
import { isAbsolute, join, relative, sep } from "node:path";

import type { EditorProjectRecord } from "../../contract/editor/EditorProjectRecord";
import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectFilePathFx } from "./assertEditorProjectFilePathFx";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";
import { readEditorProjectManifestFx } from "./readEditorProjectManifestFx";

export namespace readEditorProjectFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly projectId: string;
	}
}

const isContainedPath = (root: string, candidate: string) => {
	const child = relative(root, candidate);
	return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
};

/** Reads one contained project snapshot without exposing arbitrary filesystem paths. */
export const readEditorProjectFx = Effect.fn("readEditorProjectFx")(function* ({
	root,
	fileSystem,
	projectId: candidate,
}: readEditorProjectFx.Props) {
	const projectId = yield* assertEditorProjectIdFx(candidate);
	const manifest = yield* readEditorProjectManifestFx({
		root,
		fileSystem,
		projectId,
	});
	if (manifest === null) return null;
	const projectRoot = join(root, projectId);
	if (!(yield* fileSystem.exists(projectRoot))) return null;
	const projectInfo = yield* fileSystem.stat(projectRoot);
	if (projectInfo.type !== "Directory") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Read Arkini editor project",
				cause: new Error(`Editor project ${projectId} is not a directory.`),
			}),
		);
	}
	const canonicalRoot = yield* fileSystem.realPath(root);
	const canonicalProjectRoot = yield* fileSystem.realPath(projectRoot);
	if (
		!isContainedPath(canonicalRoot, canonicalProjectRoot) ||
		relative(join(canonicalRoot, projectId), canonicalProjectRoot) !== ""
	) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Read Arkini editor project",
				cause: new Error(`Editor project ${projectId} resolves outside the editor root.`),
			}),
		);
	}
	const entries = (yield* fileSystem.readDirectory(projectRoot, {
		recursive: true,
	}))
		.map((entry) => join(projectRoot, entry))
		.filter((path) => path.endsWith(".json") || path.endsWith(".png"))
		.sort();
	const files = yield* Effect.forEach(entries, (path) =>
		Effect.gen(function* () {
			const portablePath = yield* assertEditorProjectFilePathFx(
				relative(projectRoot, path).split(sep).join("/"),
			);
			const canonicalPath = yield* fileSystem.realPath(path);
			const expectedPath = join(canonicalProjectRoot, ...portablePath.split("/"));
			const info = yield* fileSystem.stat(canonicalPath);
			if (
				info.type !== "File" ||
				!isContainedPath(canonicalProjectRoot, canonicalPath) ||
				relative(expectedPath, canonicalPath) !== ""
			) {
				return yield* Effect.fail(
					new ElectronMainError({
						operation: "Read Arkini editor project",
						cause: new Error(
							`Editor project file ${portablePath} is not a canonical contained file.`,
						),
					}),
				);
			}
			return {
				path: portablePath,
				bytes: yield* fileSystem.readFile(canonicalPath),
			};
		}),
	);
	return {
		projectId,
		files,
	} satisfies EditorProjectRecord;
});
