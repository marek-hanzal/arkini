import { FileSystem } from "effect";
import { Effect } from "effect";

import {
	GameProjectGameSchemaReference,
	GameProjectItemSchemaReference,
} from "~/engine/source/GameProjectReference";
import { GameFileSchema } from "~/engine/source/schema/GameFileSchema";
import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createGameProjectJsonSchema } from "~/engine/schema/fx/writeGameProjectJsonSchemaFx";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import { EditorVersionHeadFileSchema } from "~/editor/filesystem/EditorVersionHeadFileSchema";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { createProjectPathsFx } from "../createProjectPathsFx";
import type { ProjectPaths } from "../ProjectPaths";
import type { ProjectFiles } from "./ProjectFiles";
import { addGitignoreRulesFx } from "./addGitignoreRulesFx";
import { assertProjectFileFx } from "./assertProjectFileFx";
import { writeProjectFileSetFx } from "./writeProjectFileSetFx";

const encoder = new TextEncoder();
const encodeJson = (value: unknown) =>
	encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`);
interface Write {
	readonly target: string;
	readonly bytes: Uint8Array;
}

interface FilesystemSnapshot {
	readonly marker: GameProjectManifestSchema.Type;
	readonly game: Write;
	readonly items: ReadonlyMap<string, Write>;
	readonly resources: ReadonlyMap<string, Write>;
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

const createSnapshotFx = Effect.fn("writeProjectFilesFx.createSnapshotFx")(function* (
	paths: ProjectPaths,
	files: ProjectFiles,
) {
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
			GameFileSchema.parse({
				$schema: GameProjectGameSchemaReference,
				version: arkpack,
				...gameCandidate,
			}),
		catch: (cause) =>
			new Error("The Editor game file is invalid.", {
				cause,
			}),
	});
	const itemWrites = new Map<string, Write>();
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
			item,
		};
		const collision = addUniqueTarget(itemWrites, {
			target,
			bytes: encodeJson(value),
		});
		if (collision !== undefined) return yield* Effect.fail(collision);
	}

	const shellResources = new Set(Object.values(config.resources));
	const resourceWrites = new Map<string, Write>();
	for (const resource of [
		...resources,
	].sort((left, right) => left.id.localeCompare(right.id))) {
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
			bytes: encodeJson(game),
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
});

export namespace writeProjectFilesFx {
	export interface Props {
		readonly root: string;
		readonly previous?: ProjectFiles;
		readonly next: ProjectFiles;
		readonly previousScenarioNames?: ReadonlyArray<string>;
		readonly scenarios?: ReadonlyArray<EditorBoardScenarioFileSchema.Type>;
		readonly versionHead?: EditorVersionHeadFileSchema.Type;
	}
}

/** Writes the complete owned current tree while preserving unrelated project files. */
export const writeProjectFilesFx = Effect.fn("writeProjectFilesFx")(function* (
	props: writeProjectFilesFx.Props,
) {
	const { root, next } = props;
	const fileSystem = yield* FileSystem.FileSystem;
	const filesystemWrite = yield* createFilesystemWriteFx();
	yield* writeProjectFileSetFx({
		filesystemWrite,
		root,
		planFx: Effect.gen(function* () {
			const paths = yield* createProjectPathsFx(root);
			const nextSnapshot = yield* createSnapshotFx(paths, next);
			const previousSnapshot =
				props.previous === undefined
					? undefined
					: yield* createSnapshotFx(paths, props.previous);
			const scenarioFiles =
				props.scenarios === undefined
					? undefined
					: yield* Effect.try({
							try: () => EditorBoardScenarioFileSchema.array().parse(props.scenarios),
							catch: (cause) =>
								new Error("The Editor Board scenarios are invalid.", {
									cause,
								}),
						});
			const versionHead =
				props.versionHead === undefined
					? undefined
					: yield* Effect.try({
							try: () => EditorVersionHeadFileSchema.parse(props.versionHead),
							catch: (cause) =>
								new Error("The Editor version head is invalid.", {
									cause,
								}),
						});
			const writes = [
				{
					target: paths.schemaFile,
					bytes: encodeJson(createGameProjectJsonSchema()),
				},
				nextSnapshot.game,
				...[
					...nextSnapshot.items.values(),
				].sort((left, right) => left.target.localeCompare(right.target)),
				...[
					...nextSnapshot.resources.values(),
				].sort((left, right) => left.target.localeCompare(right.target)),
			];
			const gitignoreExists = yield* assertProjectFileFx(
				fileSystem,
				paths.root,
				paths.gitignoreFile,
			);
			const gitignore = gitignoreExists
				? yield* fileSystem.readFileString(paths.gitignoreFile)
				: "";
			const nextGitignore = yield* addGitignoreRulesFx(gitignore);
			if (nextGitignore !== gitignore)
				writes.push({
					target: paths.gitignoreFile,
					bytes: encoder.encode(nextGitignore),
				});

			const keep = new Set([
				...nextSnapshot.items.keys(),
				...nextSnapshot.resources.keys(),
			]);
			const deletes = [
				...(previousSnapshot?.items.keys() ?? []),
				...(previousSnapshot?.resources.keys() ?? []),
			].filter((target) => !keep.has(target));

			if (scenarioFiles !== undefined) {
				const scenarioTargets = new Set<string>();
				for (const scenario of scenarioFiles) {
					const target = yield* paths.scenarioFileFx(scenario.name);
					if (scenarioTargets.has(target))
						return yield* Effect.fail(
							new Error(`Editor Board scenario ${scenario.name} is duplicated.`),
						);
					scenarioTargets.add(target);
					writes.push({
						target,
						bytes: encodeJson(scenario),
					});
				}
				for (const name of props.previousScenarioNames ?? []) {
					const target = yield* paths.scenarioFileFx(name);
					if (!scenarioTargets.has(target)) deletes.push(target);
				}
			}
			if (versionHead !== undefined)
				writes.push({
					target: paths.versionHeadFile,
					bytes: encodeJson(versionHead),
				});
			writes.push({
				target: paths.projectFile,
				bytes: encodeJson(nextSnapshot.marker),
			});
			return {
				writes,
				deletes,
			};
		}),
	});
});
