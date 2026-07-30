import { FileSystem } from "effect";
import { Effect } from "effect";
import { isAbsolute, join, relative, sep } from "node:path";

import {
	EditorProjectManifestSchema,
	type EditorProjectManifest,
} from "../../contract/editor/EditorProjectManifest";
import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";

export namespace readEditorProjectManifestFx {
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

/** Reads one canonical editor.json manifest and treats a missing marker as a stale project. */
export const readEditorProjectManifestFx = Effect.fn("readEditorProjectManifestFx")(function* ({
	root,
	fileSystem,
	projectId: candidate,
}: readEditorProjectManifestFx.Props) {
	const projectId = yield* assertEditorProjectIdFx(candidate);
	const projectRoot = join(root, projectId);
	if (!(yield* fileSystem.exists(projectRoot))) return null;
	const projectInfo = yield* fileSystem.stat(projectRoot);
	if (projectInfo.type !== "Directory") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Read Arkini editor project manifest",
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
				operation: "Read Arkini editor project manifest",
				cause: new Error(`Editor project ${projectId} resolves outside the editor root.`),
			}),
		);
	}
	const manifestPath = join(projectRoot, "editor.json");
	if (!(yield* fileSystem.exists(manifestPath))) return null;
	const canonicalManifestPath = yield* fileSystem.realPath(manifestPath);
	if (relative(join(canonicalProjectRoot, "editor.json"), canonicalManifestPath) !== "") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Read Arkini editor project manifest",
				cause: new Error(`Editor project ${projectId} has a non-canonical editor.json.`),
			}),
		);
	}
	const info = yield* fileSystem.stat(canonicalManifestPath);
	if (info.type !== "File") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Read Arkini editor project manifest",
				cause: new Error(`Editor project ${projectId} editor.json is not a file.`),
			}),
		);
	}
	const source = yield* fileSystem.readFileString(canonicalManifestPath);
	const manifest = yield* Effect.try({
		try: () => EditorProjectManifestSchema.parse(JSON.parse(source) as unknown),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Read Arkini editor project manifest",
				cause,
			}),
	});
	if (manifest.projectId !== projectId) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Read Arkini editor project manifest",
				cause: new Error(
					`Editor manifest ${manifest.projectId} does not match workspace ${projectId}.`,
				),
			}),
		);
	}
	return manifest satisfies EditorProjectManifest;
});
