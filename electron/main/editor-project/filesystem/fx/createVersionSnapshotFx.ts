import { Buffer } from "node:buffer";
import { FileSystem } from "effect";
import { Effect } from "effect";

import type { ProjectPaths } from "../ProjectPaths";
import { BoardScenarioSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import type { VersionManifestSchema } from "~/project-version/schema/VersionManifestSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { isFilesystemPathSafeFx } from "~/filesystem-write/fx/isFilesystemPathSafeFx";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { hashVersionBytesFn } from "~/project-version/fn/createVersionFingerprintFn";
import { assertProjectDirectoryFx } from "./assertProjectDirectoryFx";
import { planVersionSnapshotFx } from "~/project-version/fx/planVersionSnapshotFx";

const encoder = new TextEncoder();
const VersionObjectWriteConcurrency = 4;

export namespace createVersionSnapshotFx {
	export interface Props {
		readonly arkpack: GameVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly filesystemWrite: FilesystemWrite;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<BoardScenarioSchema.Type>;
		readonly paths: ProjectPaths;
	}

	export interface Success {
		readonly manifest: VersionManifestSchema.Type;
		readonly contentFingerprint: string;
	}
}

/** Writes one deduplicated immutable full snapshot without publishing a version. */
export const createVersionSnapshotFx = Effect.fn("createVersionSnapshotFx")(function* ({
	arkpack,
	config,
	filesystemWrite,
	resources,
	scenarios,
	paths,
}: createVersionSnapshotFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const lock = `${paths.root}/editor.lock`;
	const snapshotScenarios = yield* Effect.try({
		try: () =>
			scenarios.map((scenario) => {
				const parsed = BoardScenarioSchema.parse(scenario);
				return BoardScenarioFileSchema.parse({
					name: parsed.name,
					revision: parsed.projectRevision,
					version: parsed.version,
					save: Buffer.from(parsed.bytes).toString("base64"),
					createdAtMs: parsed.createdAtMs,
					updatedAtMs: parsed.updatedAtMs,
				});
			}),
		catch: (cause) =>
			new Error("The Editor version snapshot is invalid.", {
				cause,
			}),
	});
	const plan = yield* planVersionSnapshotFx({
		arkpack,
		config,
		resources,
		scenarios: snapshotScenarios,
	}).pipe(
		Effect.mapError(
			(cause) =>
				new Error("The Editor version snapshot is invalid.", {
					cause,
				}),
		),
	);
	yield* fileSystem.makeDirectory(paths.objects, {
		recursive: true,
	});
	yield* assertProjectDirectoryFx({
		root: paths.root,
		directory: paths.objects,
	});
	const readExistingObjectHashFx = Effect.fn("createVersionSnapshotFx.readExistingObjectHashFx")(
		function* (target: string) {
			if (!(yield* isFilesystemPathSafeFx(fileSystem, paths.root, target)))
				return yield* Effect.fail(
					new Error(`Editor version object ${target} must not be a symbolic link.`),
				);
			if (!(yield* fileSystem.exists(target))) return undefined;
			return hashVersionBytesFn(yield* fileSystem.readFile(target));
		},
	);
	const objectWrites: Array<{
		readonly target: string;
		readonly bytes: Uint8Array;
	}> = [];
	for (const [hash, value] of [
		...plan.jsonObjects,
	].sort(([left], [right]) => left.localeCompare(right))) {
		const target = yield* paths.jsonObjectFileFx(hash);
		if ((yield* readExistingObjectHashFx(target)) === hash) continue;
		objectWrites.push({
			target,
			bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
		});
	}
	for (const [hash, bytes] of [
		...plan.pngObjects,
	].sort(([left], [right]) => left.localeCompare(right))) {
		const target = yield* paths.pngObjectFileFx(hash);
		if ((yield* readExistingObjectHashFx(target)) === hash) continue;
		objectWrites.push({
			target,
			bytes,
		});
	}
	if (objectWrites.length > 0)
		yield* filesystemWrite.replaceIndependentFilesFx({
			lock,
			files: objectWrites,
			concurrency: VersionObjectWriteConcurrency,
		});
	return {
		manifest: plan.manifest,
		contentFingerprint: plan.contentFingerprint,
	} satisfies createVersionSnapshotFx.Success;
});
