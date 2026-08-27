import { Exit, FileSystem, Path } from "effect";
import { Effect } from "effect";

import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import { readEditorJsonExportFx } from "./readEditorJsonExportFx";

const portableDirectories = [
	"items",
	"assets",
	"resources",
	"notes",
	"scenarios",
	"versions",
	"objects",
] as const;

const containsPath = (path: Path.Path, parent: string, candidate: string) => {
	const relative = path.relative(parent, candidate);
	return (
		relative === "" ||
		(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
	);
};

const isPortableEditorProjectFile = (path: Path.Path, relative: string) => {
	const segments = relative.split(path.sep);
	if (segments.length === 1)
		return [
			"schema.json",
			"project.json",
			"game.json",
		].includes(segments[0] ?? "");
	if (segments.length === 2) {
		const [directory, file] = segments;
		return directory === "assets" || directory === "resources"
			? file?.endsWith(".png") === true
			: directory === "notes" || directory === "scenarios"
				? file?.endsWith(".json") === true
				: directory === "objects"
					? file?.endsWith(".json") === true || file?.endsWith(".png") === true
					: directory === "versions" && file === "head.json";
	}
	return (
		segments.length === 3 &&
		((segments[0] === "items" && segments[2]?.endsWith(".json") === true) ||
			(segments[0] === "versions" &&
				(segments[2] === "version.json" || segments[2] === "manifest.json")))
	);
};

const copyPortableEditorProjectFx = Effect.fn("copyPortableEditorProjectFx")(function* ({
	source,
	target,
}: {
	readonly source: string;
	readonly target: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const canonicalSource = yield* fileSystem.realPath(source);
	for (const directory of portableDirectories)
		yield* fileSystem.makeDirectory(path.join(target, directory));
	const files = (yield* fileSystem.readDirectory(canonicalSource, {
		recursive: true,
	}))
		.filter((relative) => isPortableEditorProjectFile(path, relative))
		.sort();
	for (const relative of files) {
		const sourceFile = path.join(canonicalSource, relative);
		const targetFile = path.join(target, relative);
		const info = yield* fileSystem.stat(sourceFile);
		if (info.type !== "File" || (yield* fileSystem.realPath(sourceFile)) !== sourceFile)
			return yield* Effect.fail(
				new Error(`Editor export source ${relative} is not a canonical file.`),
			);
		yield* fileSystem.makeDirectory(path.dirname(targetFile), {
			recursive: true,
		});
		yield* fileSystem.copyFile(sourceFile, targetFile);
	}
});

const syncEditorJsonExportTreeFx = Effect.fn("syncEditorJsonExportTreeFx")(function* (
	root: string,
	files: ReadonlyArray<string>,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const directories = [
		root,
	];
	for (const file of files) {
		const target = path.join(root, file);
		const info = yield* fileSystem.stat(target);
		if ((yield* fileSystem.realPath(target)) !== target)
			return yield* Effect.fail(new Error(`Editor export entry ${file} is not canonical.`));
		if (info.type === "File") yield* syncFilesystemPathFx(fileSystem, target);
		else if (info.type === "Directory") directories.push(target);
		else return yield* Effect.fail(new Error(`Editor export entry ${file} is not portable.`));
	}
	for (const directory of directories.sort((left, right) => right.length - left.length))
		yield* syncFilesystemPathFx(fileSystem, directory);
});

export namespace createEditorJsonExportDirectoryFx {
	export interface Props {
		readonly directoryName: string;
		readonly parent: string;
		readonly source: string;
	}

	export interface Success {
		readonly json: number;
		readonly resources: number;
		readonly revision: number;
		readonly root: string;
	}
}

/** Creates and owns one new directly re-openable portable Editor project directory. */
export const createEditorJsonExportDirectoryFx = Effect.fn("createEditorJsonExportDirectoryFx")(
	function* ({ directoryName, parent, source }: createEditorJsonExportDirectoryFx.Props) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const canonicalParent = yield* fileSystem.realPath(parent);
		const canonicalSource = yield* fileSystem.realPath(source);
		const parentInfo = yield* fileSystem.stat(canonicalParent);
		if (parentInfo.type !== "Directory")
			return yield* Effect.fail(new Error(`The Editor export destination is not a folder.`));
		return yield* Effect.acquireUseRelease(
			fileSystem.makeTempDirectory({
				directory: canonicalParent,
				prefix: `${directoryName}-json-`,
			}),
			(target) =>
				Effect.gen(function* () {
					if (
						containsPath(path, canonicalSource, target) ||
						containsPath(path, target, canonicalSource)
					)
						return yield* Effect.fail(
							new Error("The export folder must be outside the open Editor project."),
						);
					yield* copyPortableEditorProjectFx({
						source,
						target,
					});
					const { files, project } = yield* readEditorJsonExportFx(target);
					yield* syncEditorJsonExportTreeFx(target, files);
					yield* syncFilesystemPathFx(fileSystem, canonicalParent).pipe(Effect.ignore);
					return {
						json: files.filter((file) => file.endsWith(".json")).length,
						resources: files.filter((file) => file.endsWith(".png")).length,
						revision: project.marker.revision,
						root: target,
					} satisfies createEditorJsonExportDirectoryFx.Success;
				}),
			(target, exit) =>
				Exit.isSuccess(exit)
					? Effect.void
					: fileSystem
							.remove(target, {
								force: true,
								recursive: true,
							})
							.pipe(Effect.ignore),
		);
	},
);
