import { FileSystem } from "effect";
import { Effect } from "effect";

import type { ProjectPaths } from "../ProjectPaths";
import { EditorBoardScenarioFileSchema } from "~/board-scenario/schema/EditorBoardScenarioFileSchema";
import { GameFileSchema } from "~/game-config/source/schema/GameFileSchema";
import { EditorVersionManifestSchema } from "~/project-version/schema/EditorVersionManifestSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";
import { createVersionFingerprint, hashVersionBytes } from "./VersionFingerprint";

const decoder = new TextDecoder("utf-8", {
	fatal: true,
});

export namespace readVersionSnapshotFx {
	export interface Props {
		readonly manifest: EditorVersionManifestSchema.Type;
		readonly objectCache?: Map<string, Uint8Array>;
		readonly paths: ProjectPaths;
	}

	export interface Success {
		readonly arkpack: ArkpackVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<EditorBoardScenarioFileSchema.Type>;
		readonly contentFingerprint: string;
	}
}

/** Verifies and materializes every object referenced by one full version manifest. */
export const readVersionSnapshotFx = Effect.fn("readVersionSnapshotFx")(function* ({
	manifest: candidateManifest,
	objectCache,
	paths,
}: readVersionSnapshotFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const manifest = yield* Effect.try({
		try: () => EditorVersionManifestSchema.parse(candidateManifest),
		catch: (cause) =>
			new Error("The Editor version manifest is invalid.", {
				cause,
			}),
	});

	const readObjectFx = Effect.fn("readVersionObjectFx")(function* (
		hash: string,
		type: "json" | "png",
	) {
		const cacheKey = `${type}:${hash}`;
		const cached = objectCache?.get(cacheKey);
		if (cached !== undefined) return cached;
		const target =
			type === "json"
				? yield* paths.jsonObjectFileFx(hash)
				: yield* paths.pngObjectFileFx(hash);
		if (!(yield* isFilesystemPathSafeFx(fileSystem, paths.root, target)))
			return yield* Effect.fail(
				new Error(`Editor version object ${hash} must not be a symbolic link.`),
			);
		const bytes = yield* fileSystem.readFile(target);
		const actual = hashVersionBytes(bytes);
		if (actual !== hash)
			return yield* Effect.fail(
				new Error(`Editor version object ${hash} failed its content hash check.`),
			);
		objectCache?.set(cacheKey, bytes);
		return bytes;
	});
	const readJsonObjectFx = Effect.fn("readVersionJsonObjectFx")(function* (hash: string) {
		const bytes = yield* readObjectFx(hash, "json");
		return yield* Effect.try({
			try: () => JSON.parse(decoder.decode(bytes)) as unknown,
			catch: (cause) =>
				new Error(`Editor version JSON object ${hash} is invalid.`, {
					cause,
				}),
		});
	});

	const gameFile = yield* readJsonObjectFx(manifest.game).pipe(
		Effect.flatMap((candidate) =>
			Effect.try({
				try: () => GameFileSchema.parse(candidate),
				catch: (cause) =>
					new Error("The Editor version game object is invalid.", {
						cause,
					}),
			}),
		),
	);
	const { version, ...game } = gameFile;
	const items: Record<string, ItemSchema.Type> = {};
	for (const [uid, hash] of Object.entries(manifest.items).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const item = yield* readJsonObjectFx(hash).pipe(
			Effect.flatMap((candidate) =>
				Effect.try({
					try: () => ItemSchema.parse(candidate),
					catch: (cause) =>
						new Error(`Editor version item ${uid} is invalid.`, {
							cause,
						}),
				}),
			),
		);
		if (item.uid !== uid)
			return yield* Effect.fail(
				new Error(`Editor version item ${item.id} does not match manifest UID ${uid}.`),
			);
		if (items[item.id] !== undefined)
			return yield* Effect.fail(
				new Error(`Editor version item ID ${item.id} is duplicated.`),
			);
		items[item.id] = item;
	}
	const config = yield* Effect.try({
		try: () =>
			GameConfigSchema.parse({
				...game,
				items,
			}),
		catch: (cause) =>
			new Error("The reconstructed Editor version config is invalid.", {
				cause,
			}),
	});

	const shellResourceIds = new Set(
		Object.values(config.resources).filter((id): id is string => id !== undefined),
	);
	const resources: Array<ResourceSchema.Type> = [];
	const resourceIds = new Set<string>();
	for (const [kind, entries] of [
		[
			"asset",
			manifest.assets,
		],
		[
			"resource",
			manifest.resources,
		],
	] as const) {
		for (const [id, hash] of Object.entries(entries).sort(([left], [right]) =>
			left.localeCompare(right),
		)) {
			if (resourceIds.has(id))
				return yield* Effect.fail(
					new Error(`Editor version resource ID ${id} is duplicated.`),
				);
			const expectedKind = shellResourceIds.has(id) ? "resource" : "asset";
			if (kind !== expectedKind)
				return yield* Effect.fail(
					new Error(
						`Editor version ${kind} ${id} belongs in the ${expectedKind} manifest.`,
					),
				);
			resourceIds.add(id);
			resources.push(
				ResourceSchema.parse({
					id,
					mime: "image/png",
					bytes: Uint8Array.from(yield* readObjectFx(hash, "png")),
				}),
			);
		}
	}
	resources.sort((left, right) => left.id.localeCompare(right.id));

	const scenarios: Array<EditorBoardScenarioFileSchema.Type> = [];
	for (const [name, hash] of Object.entries(manifest.scenarios).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const scenario = yield* readJsonObjectFx(hash).pipe(
			Effect.flatMap((candidate) =>
				Effect.try({
					try: () => EditorBoardScenarioFileSchema.parse(candidate),
					catch: (cause) =>
						new Error(`Editor version Board scenario ${name} is invalid.`, {
							cause,
						}),
				}),
			),
		);
		if (scenario.name !== name)
			return yield* Effect.fail(
				new Error(`Editor version Board scenario does not match manifest name ${name}.`),
			);
		scenarios.push(scenario);
	}

	return {
		arkpack: version,
		config,
		resources,
		scenarios,
		contentFingerprint: createVersionFingerprint(manifest, scenarios),
	} satisfies readVersionSnapshotFx.Success;
});
