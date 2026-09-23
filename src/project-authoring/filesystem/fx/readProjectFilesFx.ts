import { isDeepStrictEqual } from "node:util";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { readProjectResourceMetadataFx } from "./readProjectResourceMetadataFx";
import { readResourceDescriptorsFx } from "~/game-config-resource/fx/readResourceDescriptorsFx";
import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { GameFileSchema } from "~/game-config-source/schema/GameFileSchema";
import { ItemFileSchema } from "~/game-config-source/schema/ItemFileSchema";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { admitSerakkiVersionFx } from "~/application-version/fx/admitSerakkiVersionFx";
import type { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import { createProjectPathsFx } from "../createProjectPathsFx";
import { collectSourceFilesFx } from "~/game-config-source/fx/collectSourceFilesFx";

const parseJsonFx = <Value>(file: string, parseFn: (candidate: unknown) => Value, label: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const source = yield* fileSystem.readFileString(file);
		return yield* Effect.try({
			try: () => parseFn(JSON.parse(source)),
			catch: (cause) =>
				new Error(`${label} ${file} is invalid.`, {
					cause,
				}),
		});
	});

const failInvalidItemFileFx = (file: string, message: string) =>
	Effect.fail(new Error(`Editor item file ${file} is invalid: ${message}`));

/** Reads and validates the authoritative current tree below one Editor project root. */
export const readProjectFilesFx = Effect.fn("readProjectFilesFx")(function* (projectRoot: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const paths = yield* createProjectPathsFx(projectRoot);
	const marker = yield* parseJsonFx(
		paths.projectFile,
		(candidate) => GameProjectManifestSchema.parse(candidate),
		"Editor project marker",
	);
	const gameSchema = yield* parseJsonFx(
		paths.schemaFile,
		(candidate) => candidate,
		"Editor game schema",
	);
	if (!isDeepStrictEqual(gameSchema, GameProjectJsonSchema))
		return yield* Effect.fail(
			new Error("The Editor game schema does not match the current project schema."),
		);
	const gameFile = yield* parseJsonFx(
		paths.gameFile,
		(candidate) => GameFileSchema.parse(candidate),
		"Editor game file",
	);
	const { version, ...game } = gameFile;
	const itemFiles = (yield* fileSystem.readDirectory(paths.items, {
		recursive: true,
	}))
		.filter((file) => file.endsWith(".json"))
		.sort();
	const sources: Array<GameSourceFileSchema.Type> = [
		{
			path: paths.gameFile,
			value: game,
		},
	];
	const itemUids = new Set<string>();

	for (const relativeFile of itemFiles) {
		const sourcePath = path.join(paths.items, relativeFile);
		const segments = relativeFile.replaceAll("\\", "/").split("/");
		if (segments.length !== 1) {
			return yield* failInvalidItemFileFx(sourcePath, "expected items/<encoded uid>.json.");
		}
		const source = yield* parseJsonFx(
			sourcePath,
			(candidate) => ItemFileSchema.parse(candidate),
			"Editor item file",
		);
		const item = source.item;
		const itemUid = item.uid;
		if (itemUids.has(item.uid)) {
			return yield* failInvalidItemFileFx(sourcePath, `item UID ${item.uid} is duplicated.`);
		}
		itemUids.add(item.uid);
		const expectedPath = yield* paths.itemFileFx({
			uid: item.uid,
		});
		if (path.resolve(sourcePath) !== expectedPath) {
			return yield* failInvalidItemFileFx(
				sourcePath,
				`expected immutable UID path ${expectedPath}.`,
			);
		}
		sources.push({
			path: sourcePath,
			value: {
				$schema: source.$schema,
				items: {
					[itemUid]: item,
				},
			},
		});
	}

	const compilation = yield* compileGameSourcesFx(sources);
	if (compilation.config === undefined) {
		const firstDiagnostic = compilation.diagnostics[0];
		return yield* Effect.fail(
			new Error(
				firstDiagnostic === undefined
					? "Editor project config is structurally invalid."
					: `Editor project config is structurally invalid: ${firstDiagnostic.message}`,
			),
		);
	}
	const config = compilation.config;
	const descriptors = yield* readResourceDescriptorsFx({
		input: paths.root,
	});
	const sourceFiles = yield* collectSourceFilesFx({
		input: paths.root,
	});
	const metadataPaths = new Set(descriptors.map(({ path }) => `${path.slice(0, -4)}.json`));
	for (const metadataPath of sourceFiles.resourceMetadata) {
		if (!metadataPaths.has(metadataPath))
			return yield* Effect.fail(
				new Error(`Resource metadata ${metadataPath} has no paired resource.`),
			);
	}
	const resourceUids = new Set<string>();
	for (const descriptor of descriptors) {
		if (resourceUids.has(descriptor.uid)) {
			return yield* Effect.fail(
				new Error(`Editor resource ID ${descriptor.uid} is duplicated.`),
			);
		}
		resourceUids.add(descriptor.uid);
		const expectedPath = yield* paths.resourceFileFx(descriptor);
		if (path.resolve(descriptor.path) !== expectedPath) {
			return yield* Effect.fail(
				new Error(
					`Editor resource ${descriptor.path} is invalid: expected resource path ${expectedPath}.`,
				),
			);
		}
	}
	const resources = yield* Effect.forEach(
		[
			...descriptors,
		].sort((left, right) =>
			left.uid === right.uid
				? left.path.localeCompare(right.path)
				: left.uid.localeCompare(right.uid),
		),
		({ uid, type, path: resourcePath }) =>
			readProjectResourceMetadataFx(uid, type, resourcePath),
	);
	yield* admitSerakkiVersionFx("Editor project", marker.serakki);

	return {
		serapack: version,
		marker,
		config,
		resources,
	};
});
