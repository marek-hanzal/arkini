import { FileSystem } from "effect";
import { Effect } from "effect";

import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import { GameProjectFileSchema } from "~/engine/source/schema/GameProjectFileSchema";
import { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import {
	createFilesystemEditorVersionFingerprint,
	hashFilesystemEditorVersionBytes,
} from "./FilesystemEditorVersionFingerprint";

const decoder = new TextDecoder("utf-8", {
	fatal: true,
});

export namespace readFilesystemEditorVersionSnapshotFx {
	export interface Props {
		readonly manifest: EditorVersionManifestSchema.Type;
		readonly paths: EditorProjectFilesystemPaths;
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
export const readFilesystemEditorVersionSnapshotFx = Effect.fn(
	"readFilesystemEditorVersionSnapshotFx",
)(function* ({ manifest: candidateManifest, paths }: readFilesystemEditorVersionSnapshotFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const manifest = yield* Effect.try({
		try: () => EditorVersionManifestSchema.parse(candidateManifest),
		catch: (cause) =>
			new Error("The Editor version manifest is invalid.", {
				cause,
			}),
	});

	const readObjectFx = Effect.fn("readFilesystemEditorVersionObjectFx")(function* (
		hash: string,
		type: "json" | "png",
	) {
		const target =
			type === "json"
				? yield* paths.jsonObjectFileFx(hash)
				: yield* paths.pngObjectFileFx(hash);
		const bytes = yield* fileSystem.readFile(target);
		const actual = hashFilesystemEditorVersionBytes(bytes);
		if (actual !== hash)
			return yield* Effect.fail(
				new Error(`Editor version object ${hash} failed its content hash check.`),
			);
		return bytes;
	});
	const readJsonObjectFx = Effect.fn("readFilesystemEditorVersionJsonObjectFx")(function* (
		hash: string,
	) {
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
				try: () => GameProjectFileSchema.parse(candidate),
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
		contentFingerprint: createFilesystemEditorVersionFingerprint(manifest, scenarios),
	} satisfies readFilesystemEditorVersionSnapshotFx.Success;
});
