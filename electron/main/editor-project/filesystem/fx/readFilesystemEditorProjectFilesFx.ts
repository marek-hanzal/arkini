import { isDeepStrictEqual } from "node:util";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { readPngAssetFx } from "~/engine/pack/fx/readPngAssetFx";
import { readResourceDescriptorsFx } from "~/engine/resource/fx/readResourceDescriptorsFx";
import { createGameProjectJsonSchema } from "~/engine/schema/fx/writeGameProjectJsonSchemaFx";
import { GameProjectFileSchema } from "~/engine/source/schema/GameProjectFileSchema";
import { GameProjectItemFileSchema } from "~/engine/source/schema/GameProjectItemFileSchema";
import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import type { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import { createEditorProjectFilesystemPathsFx } from "../createEditorProjectFilesystemPathsFx";
import type { FilesystemEditorProjectFiles } from "./FilesystemEditorProjectFiles";

const parseJsonFx = <Value>(file: string, parse: (candidate: unknown) => Value, label: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const source = yield* fileSystem.readFileString(file);
		return yield* Effect.try({
			try: () => parse(JSON.parse(source)),
			catch: (cause) =>
				new Error(`${label} ${file} is invalid.`, {
					cause,
				}),
		});
	});

const failInvalidItemFileFx = (file: string, message: string) =>
	Effect.fail(new Error(`Editor item file ${file} is invalid: ${message}`));

/** Reads and validates the authoritative current tree below one Editor project root. */
export const readFilesystemEditorProjectFilesFx = Effect.fn("readFilesystemEditorProjectFilesFx")(
	function* (projectRoot: string) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const paths = yield* createEditorProjectFilesystemPathsFx(projectRoot);
		const canonicalRoot = yield* fileSystem.realPath(paths.root);
		const assertCanonicalPathFx = (target: string) =>
			Effect.gen(function* () {
				const actual = yield* fileSystem.realPath(target);
				const expected = path.join(canonicalRoot, path.relative(paths.root, target));
				if (actual !== expected)
					return yield* Effect.fail(
						new Error(`Editor project path ${target} must not be a symbolic link.`),
					);
			});
		for (const required of [
			paths.projectFile,
			paths.schemaFile,
			paths.gameFile,
			paths.items,
		])
			yield* assertCanonicalPathFx(required);
		for (const optional of [
			paths.assets,
			paths.resources,
			paths.notes,
			paths.scenarios,
			paths.versions,
			paths.objects,
		]) {
			if (yield* fileSystem.exists(optional)) yield* assertCanonicalPathFx(optional);
		}
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
		if (!isDeepStrictEqual(gameSchema, createGameProjectJsonSchema()))
			return yield* Effect.fail(
				new Error("The Editor game schema does not match this Arkini version."),
			);
		const gameFile = yield* parseJsonFx(
			paths.gameFile,
			(candidate) => GameProjectFileSchema.parse(candidate),
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
		const itemIds = new Set<string>();
		const itemUids = new Set<string>();

		for (const relativeFile of itemFiles) {
			const sourcePath = path.join(paths.items, relativeFile);
			yield* assertCanonicalPathFx(sourcePath);
			const segments = relativeFile.replaceAll("\\", "/").split("/");
			if (segments.length !== 2) {
				return yield* failInvalidItemFileFx(
					sourcePath,
					"expected items/<type>/<encoded uid>.json.",
				);
			}
			const parsedType = ItemEnumSchema.safeParse(segments[0]);
			if (!parsedType.success) {
				return yield* failInvalidItemFileFx(
					sourcePath,
					"the directory is not an item type.",
				);
			}
			const source = yield* parseJsonFx(
				sourcePath,
				(candidate) => GameProjectItemFileSchema.parse(candidate),
				"Editor item file",
			);
			const item = source.item;
			const itemId = item.id;
			if (itemIds.has(itemId)) {
				return yield* failInvalidItemFileFx(sourcePath, `item ID ${itemId} is duplicated.`);
			}
			if (itemUids.has(item.uid)) {
				return yield* failInvalidItemFileFx(
					sourcePath,
					`item UID ${item.uid} is duplicated.`,
				);
			}
			itemIds.add(itemId);
			itemUids.add(item.uid);
			if (item.type !== parsedType.data) {
				return yield* failInvalidItemFileFx(
					sourcePath,
					`item type ${JSON.stringify(item.type)} differs from its directory.`,
				);
			}
			const expectedPath = yield* paths.itemFileFx({
				type: item.type,
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
						[itemId]: item,
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
		const shellResources = new Set(Object.values(config.resources));
		const resourceIds = new Set<string>();
		for (const descriptor of descriptors) {
			yield* assertCanonicalPathFx(descriptor.path);
			if (resourceIds.has(descriptor.id)) {
				return yield* Effect.fail(
					new Error(`Editor PNG resource ID ${descriptor.id} is duplicated.`),
				);
			}
			resourceIds.add(descriptor.id);
			const expectedPath = yield* shellResources.has(descriptor.id)
				? paths.resourceFileFx(descriptor.id)
				: paths.assetFileFx(descriptor.id);
			if (path.resolve(descriptor.path) !== expectedPath) {
				return yield* Effect.fail(
					new Error(
						`Editor PNG ${descriptor.path} is invalid: expected resource path ${expectedPath}.`,
					),
				);
			}
		}
		const resources = yield* Effect.forEach(
			[
				...descriptors,
			].sort((left, right) =>
				left.id === right.id
					? left.path.localeCompare(right.path)
					: left.id.localeCompare(right.id),
			),
			({ path: resourcePath }) =>
				readPngAssetFx({
					path: resourcePath,
				}).pipe(
					Effect.map((resource) => ({
						...resource,
						bytes: new Uint8Array(resource.bytes),
					})),
				),
		);

		return {
			arkpack: version,
			marker,
			config,
			resources,
		} satisfies FilesystemEditorProjectFiles;
	},
);
