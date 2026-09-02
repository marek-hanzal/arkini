import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import { compileGameDirectoryFx } from "~/game-config-compiler/fx/compileGameDirectoryFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { readPngResourceFx } from "~/game-config-resource/fx/readPngResourceFx";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { planVersionSnapshotFx } from "~/project-version/fx/planVersionSnapshotFx";
import { readVersionSnapshotFx } from "~/project-version/fx/readVersionSnapshotFx";
import { VersionDescriptorFileSchema } from "~/project-version/schema/VersionDescriptorFileSchema";
import { VersionHeadFileSchema } from "~/project-version/schema/VersionHeadFileSchema";
import { VersionManifestSchema } from "~/project-version/schema/VersionManifestSchema";

const readJsonFx = Effect.fn("readCommittedProjectHeadFx.readJsonFx")(function* <Value>(
	file: string,
	parseFn: (candidate: unknown) => Value,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(file);
	return yield* Effect.try({
		try: () => parseFn(JSON.parse(source)),
		catch: (cause) =>
			new Error(`Project version file ${file} is invalid.`, {
				cause,
			}),
	});
});

const readScenarioFilesFx = Effect.fn("readCommittedProjectHeadFx.readScenarioFilesFx")(function* (
	directory: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fileSystem.exists(directory))) return [];
	const names = (yield* fileSystem.readDirectory(directory))
		.filter((name) => path.extname(name) === ".json")
		.sort();
	return yield* Effect.forEach(names, (name) =>
		readJsonFx(path.join(directory, name), (candidate) =>
			BoardScenarioFileSchema.parse(candidate),
		),
	);
});

interface CommittedProjectHead {
	readonly version: GameVersionSchema.Type;
	readonly versionId: string;
}

/** Proves that one portable source tree is exactly its published Version HEAD. */
export const readCommittedProjectHeadFx = Effect.fn("readCommittedProjectHeadFx")(function* (
	input: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fileSystem.realPath(path.resolve(input));
	const versions = path.join(root, "versions");
	const head = yield* readJsonFx(path.join(versions, "head.json"), (candidate) =>
		VersionHeadFileSchema.parse(candidate),
	).pipe(
		Effect.mapError(
			(cause) =>
				new Error("Commit the initial project version before building.", {
					cause,
				}),
		),
	);
	const versionDirectory = path.join(versions, encodeGameProjectFileStemFn(head.current));
	const descriptor = yield* readJsonFx(path.join(versionDirectory, "version.json"), (candidate) =>
		VersionDescriptorFileSchema.parse(candidate),
	);
	const manifest = yield* readJsonFx(path.join(versionDirectory, "manifest.json"), (candidate) =>
		VersionManifestSchema.parse(candidate),
	);
	const published = yield* readVersionSnapshotFx({
		manifest,
		root,
	});
	if (
		published.arkpack !== descriptor.version ||
		published.contentFingerprint !== descriptor.contentFingerprint
	)
		return yield* Effect.fail(
			new Error(`Version ${head.current} does not match its published snapshot.`),
		);

	const compilation = yield* compileGameDirectoryFx({
		input: root,
	});
	const config = yield* assertGameConfigValidFx(compilation);
	const identity = compilation.projectIdentity!;
	const resources = yield* Effect.forEach(compilation.resources, ({ path: resourcePath }) =>
		readPngResourceFx({
			path: resourcePath,
		}),
	);
	const scenarios = yield* readScenarioFilesFx(path.join(root, "scenarios"));
	const current = yield* planVersionSnapshotFx({
		arkpack: identity.version,
		config,
		resources,
		scenarios,
	});
	if (
		published.config.meta.id !== identity.packageId ||
		descriptor.version !== identity.version ||
		descriptor.contentFingerprint !== current.contentFingerprint
	)
		return yield* Effect.fail(new Error("Commit the saved project changes before building."));
	return {
		version: descriptor.version,
		versionId: head.current,
	} satisfies CommittedProjectHead;
});
