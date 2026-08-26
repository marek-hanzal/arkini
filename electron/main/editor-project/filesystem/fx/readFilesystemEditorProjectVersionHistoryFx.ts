import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import type {
	FilesystemEditorProjectVersionHistory,
	FilesystemEditorPublishedVersion,
} from "../FilesystemEditorProjectVersionHistory";
import { EditorVersionDescriptorFileSchema } from "~/editor/filesystem/EditorVersionDescriptorFileSchema";
import { EditorVersionHeadFileSchema } from "~/editor/filesystem/EditorVersionHeadFileSchema";
import { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";

const readJsonFx = <Value>(target: string, parse: (candidate: unknown) => Value, message: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const source = yield* fileSystem.readFileString(target);
		return yield* Effect.try({
			try: () => parse(JSON.parse(source)),
			catch: (cause) =>
				new Error(message, {
					cause,
				}),
		});
	});

/** Captures the published head, descriptors, and manifests; unlisted orphan files stay invisible. */
export const readFilesystemEditorProjectVersionHistoryFx = Effect.fn(
	"readFilesystemEditorProjectVersionHistoryFx",
)(function* (paths: EditorProjectFilesystemPaths) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fileSystem.exists(paths.versionHeadFile)))
		return {
			versions: new Map(),
		} satisfies FilesystemEditorProjectVersionHistory;

	const canonicalRoot = yield* fileSystem.realPath(paths.root);
	const assertCanonicalPathFx = (target: string) =>
		Effect.gen(function* () {
			const expected = path.join(canonicalRoot, path.relative(paths.root, target));
			if ((yield* fileSystem.realPath(target)) !== expected)
				return yield* Effect.fail(
					new Error(`Editor version path ${target} must not be a symbolic link.`),
				);
		});
	yield* assertCanonicalPathFx(paths.versionHeadFile);
	const head = yield* readJsonFx(
		paths.versionHeadFile,
		(candidate) => EditorVersionHeadFileSchema.parse(candidate),
		"The Editor version head is invalid.",
	);
	const versions = new Map<string, FilesystemEditorPublishedVersion>();
	for (const versionId of head.versionIds) {
		const descriptorFile = yield* paths.versionDescriptorFileFx(versionId);
		const manifestFile = yield* paths.versionManifestFileFx(versionId);
		yield* assertCanonicalPathFx(descriptorFile);
		yield* assertCanonicalPathFx(manifestFile);
		const descriptor = yield* readJsonFx(
			descriptorFile,
			(candidate) => EditorVersionDescriptorFileSchema.parse(candidate),
			`Editor version ${versionId} descriptor is invalid.`,
		);
		if (descriptor.versionId !== versionId)
			return yield* Effect.fail(
				new Error(`Editor version descriptor does not match version ${versionId}.`),
			);
		const manifest = yield* readJsonFx(
			manifestFile,
			(candidate) => EditorVersionManifestSchema.parse(candidate),
			`Editor version ${versionId} manifest is invalid.`,
		);
		versions.set(versionId, {
			descriptor,
			manifest,
		});
	}
	return {
		head,
		versions,
	} satisfies FilesystemEditorProjectVersionHistory;
});
