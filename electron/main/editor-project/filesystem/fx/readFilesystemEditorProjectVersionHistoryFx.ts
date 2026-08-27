import { FileSystem } from "effect";
import { Effect } from "effect";

import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import type {
	FilesystemEditorProjectVersionHistory,
	FilesystemEditorPublishedVersion,
} from "../FilesystemEditorProjectVersionHistory";
import { EditorVersionDescriptorFileSchema } from "~/editor/filesystem/EditorVersionDescriptorFileSchema";
import { EditorVersionHeadFileSchema } from "~/editor/filesystem/EditorVersionHeadFileSchema";
import { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";
import { admitArkiniVersionFx } from "~/engine/version/ArkiniVersionAdmission";
import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";
import { readFilesystemEditorVersionSnapshotFx } from "./readFilesystemEditorVersionSnapshotFx";

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
	if (!(yield* fileSystem.exists(paths.versionHeadFile)))
		return {
			versions: new Map(),
		} satisfies FilesystemEditorProjectVersionHistory;

	const assertCanonicalPathFx = (target: string) =>
		Effect.gen(function* () {
			if (!(yield* isFilesystemPathSafeFx(fileSystem, paths.root, target)))
				return yield* Effect.fail(
					new Error(`Editor version path ${target} must not be a symbolic link.`),
				);
		});
	yield* assertCanonicalPathFx(paths.versionHeadFile);
	const head = yield* readJsonFx(
		paths.versionHeadFile,
		(candidate) => EditorVersionHeadFileSchema.parse(candidate),
		`Editor version head ${paths.versionHeadFile} is invalid.`,
	);
	const versions = new Map<string, FilesystemEditorPublishedVersion>();
	for (const versionId of head.versions) {
		const descriptorFile = yield* paths.versionDescriptorFileFx(versionId);
		const manifestFile = yield* paths.versionManifestFileFx(versionId);
		yield* assertCanonicalPathFx(descriptorFile);
		yield* assertCanonicalPathFx(manifestFile);
		const descriptor = yield* readJsonFx(
			descriptorFile,
			(candidate) => EditorVersionDescriptorFileSchema.parse(candidate),
			`Editor version descriptor ${descriptorFile} is invalid.`,
		);
		const manifest = yield* readJsonFx(
			manifestFile,
			(candidate) => EditorVersionManifestSchema.parse(candidate),
			`Editor version manifest ${manifestFile} is invalid.`,
		);
		versions.set(versionId, {
			descriptor,
			manifest,
		});
	}
	yield* Effect.try({
		try: () => {
			const states = new Map<string, "visiting" | "visited">();
			const visit = (versionId: string): void => {
				const state = states.get(versionId);
				if (state === "visited") return;
				if (state === "visiting")
					throw new Error(
						`Editor version history contains a parent cycle at ${versionId}.`,
					);
				states.set(versionId, "visiting");
				const parent = versions.get(versionId)?.descriptor.parentVersionId;
				if (parent !== undefined) {
					if (!versions.has(parent))
						throw new Error(
							`Editor version ${versionId} references missing parent ${parent}.`,
						);
					visit(parent);
				}
				states.set(versionId, "visited");
			};
			for (const versionId of versions.keys()) visit(versionId);
		},
		catch: (cause) => cause,
	});
	const objectCache = new Map<string, Uint8Array>();
	for (const [versionId, version] of versions) {
		const snapshot = yield* readFilesystemEditorVersionSnapshotFx({
			manifest: version.manifest,
			objectCache,
			paths,
		});
		if (snapshot.arkpack !== version.descriptor.version)
			return yield* Effect.fail(
				new Error(
					`Editor version ${versionId} Arkpack version does not match its descriptor.`,
				),
			);
		if (snapshot.contentFingerprint !== version.descriptor.contentFingerprint)
			return yield* Effect.fail(
				new Error(
					`Editor version ${versionId} content fingerprint does not match its descriptor.`,
				),
			);
	}
	for (const { descriptor } of versions.values())
		yield* admitArkiniVersionFx("Editor version", descriptor.arkini);
	return {
		head,
		versions,
	} satisfies FilesystemEditorProjectVersionHistory;
});
