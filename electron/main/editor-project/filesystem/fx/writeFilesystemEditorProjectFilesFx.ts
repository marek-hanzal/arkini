import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import {
	GameProjectGameSchemaReference,
	GameProjectItemSchemaReference,
} from "~/engine/source/GameProjectReference";
import { GameProjectFileSchema } from "~/engine/source/schema/GameProjectFileSchema";
import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createGameProjectJsonSchema } from "~/engine/schema/fx/writeGameProjectJsonSchemaFx";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { createEditorProjectFilesystemPathsFx } from "../createEditorProjectFilesystemPathsFx";
import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import type { FilesystemEditorProjectFiles } from "./FilesystemEditorProjectFiles";
import { ensureFilesystemEditorProjectGitignoreFx } from "./ensureFilesystemEditorProjectGitignoreFx";
import { replaceFilesystemEditorFileFx } from "./replaceFilesystemEditorFileFx";
import { replaceFilesystemEditorJsonFx } from "./replaceFilesystemEditorJsonFx";

interface JsonWrite {
	readonly target: string;
	readonly value: unknown;
	readonly serialized: string;
}

interface BinaryWrite {
	readonly target: string;
	readonly bytes: Uint8Array;
}

interface FilesystemSnapshot {
	readonly marker: GameProjectManifestSchema.Type;
	readonly game: JsonWrite;
	readonly items: ReadonlyMap<string, JsonWrite>;
	readonly resources: ReadonlyMap<string, BinaryWrite>;
}

const addUniqueTarget = <
	Write extends {
		readonly target: string;
	},
>(
	targets: Map<string, Write>,
	write: Write,
) => {
	const collisionKey = write.target.normalize("NFD").toLowerCase();
	const collision = targets.get(collisionKey);
	if (collision !== undefined) {
		return new Error(
			`Editor files ${JSON.stringify(collision.target)} and ${JSON.stringify(write.target)} collide on this filesystem.`,
		);
	}
	targets.set(collisionKey, write);
	return undefined;
};

const createSnapshotFx = Effect.fn("writeFilesystemEditorProjectFilesFx.createSnapshotFx")(
	function* (paths: EditorProjectFilesystemPaths, files: FilesystemEditorProjectFiles) {
		const config = yield* Effect.try({
			try: () => GameConfigSchema.parse(files.config),
			catch: (cause) =>
				new Error("The Editor project config is invalid.", {
					cause,
				}),
		});
		const marker = yield* Effect.try({
			try: () => GameProjectManifestSchema.parse(files.marker),
			catch: (cause) =>
				new Error("The Editor project marker is invalid.", {
					cause,
				}),
		});
		const arkpack = yield* Effect.try({
			try: () => ArkpackVersionSchema.parse(files.arkpack),
			catch: (cause) =>
				new Error("The Editor Arkpack version is invalid.", {
					cause,
				}),
		});
		const resources = yield* Effect.try({
			try: () => ResourceSchema.array().parse(files.resources),
			catch: (cause) =>
				new Error("The Editor project resources are invalid.", {
					cause,
				}),
		});
		const { $schema: _schema, items, ...gameCandidate } = config;
		const game = yield* Effect.try({
			try: () =>
				GameProjectFileSchema.parse({
					$schema: GameProjectGameSchemaReference,
					arkpack,
					...gameCandidate,
				}),
			catch: (cause) =>
				new Error("The Editor game file is invalid.", {
					cause,
				}),
		});
		const itemWrites = new Map<string, JsonWrite>();
		const itemUids = new Set<string>();
		for (const [itemId, item] of Object.entries(items).sort(([left], [right]) =>
			left.localeCompare(right),
		)) {
			if (item.id !== itemId) {
				return yield* Effect.fail(
					new Error(
						`Editor item record key ${JSON.stringify(itemId)} differs from item ID ${JSON.stringify(item.id)}.`,
					),
				);
			}
			if (itemUids.has(item.uid)) {
				return yield* Effect.fail(new Error(`Editor item UID ${item.uid} is duplicated.`));
			}
			itemUids.add(item.uid);
			const target = yield* paths.itemFileFx({
				type: item.type,
				uid: item.uid,
			});
			const value = {
				$schema: GameProjectItemSchemaReference,
				items: {
					[itemId]: item,
				},
			};
			const collision = addUniqueTarget(itemWrites, {
				target,
				value,
				serialized: JSON.stringify(value),
			});
			if (collision !== undefined) return yield* Effect.fail(collision);
		}

		const shellResources = new Set(Object.values(config.resources));
		const resourceWrites = new Map<string, BinaryWrite>();
		for (const resource of [
			...resources,
		].sort((left, right) => left.id.localeCompare(right.id))) {
			if (resource.mime !== "image/png") {
				return yield* Effect.fail(
					new Error(
						`Resource ${resource.id} uses ${resource.mime}; Editor projects support image/png resources only.`,
					),
				);
			}
			const target = yield* shellResources.has(resource.id)
				? paths.resourceFileFx(resource.id)
				: paths.assetFileFx(resource.id);
			const collision = addUniqueTarget(resourceWrites, {
				target,
				bytes: resource.bytes,
			});
			if (collision !== undefined) return yield* Effect.fail(collision);
		}

		return {
			marker,
			game: {
				target: paths.gameFile,
				value: game,
				serialized: JSON.stringify(game),
			},
			items: new Map(
				[
					...itemWrites.values(),
				].map((write) => [
					write.target,
					write,
				]),
			),
			resources: new Map(
				[
					...resourceWrites.values(),
				].map((write) => [
					write.target,
					write,
				]),
			),
		} satisfies FilesystemSnapshot;
	},
);

export namespace writeFilesystemEditorProjectFilesFx {
	export interface Props {
		readonly root: string;
		readonly previous?: FilesystemEditorProjectFiles;
		readonly next: FilesystemEditorProjectFiles;
		readonly clearScenarios?: boolean;
	}
}

/** Publishes the complete in-memory current tree; Editor state overwrites ignored disk edits. */
export const writeFilesystemEditorProjectFilesFx = Effect.fn("writeFilesystemEditorProjectFilesFx")(
	function* (props: writeFilesystemEditorProjectFilesFx.Props) {
		const { root, next, clearScenarios = false } = props;
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const paths = yield* createEditorProjectFilesystemPathsFx(root);
		yield* ensureFilesystemEditorProjectGitignoreFx(paths);
		const nextSnapshot = yield* createSnapshotFx(paths, next);
		const currentTreeDirectories = [
			paths.root,
			paths.items,
			paths.assets,
			paths.resources,
		];
		yield* Effect.forEach(
			currentTreeDirectories,
			(directory) =>
				fileSystem.makeDirectory(directory, {
					recursive: true,
				}),
			{
				discard: true,
			},
		);
		const canonicalRoot = yield* fileSystem.realPath(paths.root);
		for (const directory of currentTreeDirectories) {
			const expected = path.join(canonicalRoot, path.relative(paths.root, directory));
			if ((yield* fileSystem.realPath(directory)) !== expected)
				return yield* Effect.fail(
					new Error(`Editor project directory ${directory} must not be a symbolic link.`),
				);
		}

		yield* replaceFilesystemEditorJsonFx(paths.schemaFile, createGameProjectJsonSchema());
		yield* replaceFilesystemEditorJsonFx(nextSnapshot.game.target, nextSnapshot.game.value);
		for (const write of [
			...nextSnapshot.items.values(),
		].sort((left, right) => left.target.localeCompare(right.target))) {
			yield* replaceFilesystemEditorJsonFx(write.target, write.value);
		}
		for (const write of [
			...nextSnapshot.resources.values(),
		].sort((left, right) => left.target.localeCompare(right.target))) {
			yield* replaceFilesystemEditorFileFx({
				target: write.target,
				bytes: write.bytes,
			});
		}

		const existingItems = (yield* fileSystem.readDirectory(paths.items, {
			recursive: true,
		}))
			.filter((file) => file.endsWith(".json"))
			.map((file) => path.join(paths.items, file));
		const existingResources = yield* Effect.forEach(
			[
				paths.assets,
				paths.resources,
			],
			(directory) =>
				fileSystem
					.readDirectory(directory)
					.pipe(
						Effect.map((files) =>
							files
								.filter((file) => file.endsWith(".png"))
								.map((file) => path.join(directory, file)),
						),
					),
		);
		for (const target of [
			...existingItems,
			...existingResources.flat(),
		].sort()) {
			if (nextSnapshot.items.has(target) || nextSnapshot.resources.has(target)) continue;
			yield* fileSystem.remove(target, {
				force: true,
			});
		}
		if (clearScenarios) {
			if (yield* fileSystem.exists(paths.scenarios)) {
				const expected = path.join(
					canonicalRoot,
					path.relative(paths.root, paths.scenarios),
				);
				if ((yield* fileSystem.realPath(paths.scenarios)) !== expected)
					return yield* Effect.fail(
						new Error(
							`Editor project directory ${paths.scenarios} must not be a symbolic link.`,
						),
					);
				yield* fileSystem.remove(paths.scenarios, {
					force: true,
					recursive: true,
				});
			}
		}

		// The marker is the publication boundary and must only advertise the completed tree.
		yield* replaceFilesystemEditorJsonFx(paths.projectFile, nextSnapshot.marker);
	},
);
