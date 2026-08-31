import { Buffer } from "node:buffer";
import { FileSystem } from "effect";
import { Effect } from "effect";

import type { ProjectPaths } from "../ProjectPaths";
import { EditorBoardScenarioSchema } from "~/board-scenario/schema/EditorBoardScenarioSchema";
import { EditorBoardScenarioFileSchema } from "~/board-scenario/schema/EditorBoardScenarioFileSchema";
import type { EditorVersionManifestSchema } from "~/project-version/schema/EditorVersionManifestSchema";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import type { FilesystemWrite } from "~/engine/filesystem/FilesystemWrite";
import { hashVersionBytes } from "./VersionFingerprint";
import { assertProjectDirectoryFx } from "./assertProjectDirectoryFx";
import { planVersionSnapshotFx } from "./planVersionSnapshotFx";

const encoder = new TextEncoder();

export namespace createVersionSnapshotFx {
	export interface Props {
		readonly arkpack: ArkpackVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly filesystemWrite: FilesystemWrite;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<EditorBoardScenarioSchema.Type>;
		readonly paths: ProjectPaths;
	}

	export interface Success {
		readonly manifest: EditorVersionManifestSchema.Type;
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
				const parsed = EditorBoardScenarioSchema.parse(scenario);
				return EditorBoardScenarioFileSchema.parse({
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
	for (const [hash, value] of [
		...plan.jsonObjects,
	].sort(([left], [right]) => left.localeCompare(right))) {
		const target = yield* paths.jsonObjectFileFx(hash);
		if (yield* fileSystem.exists(target)) {
			const current = yield* fileSystem.readFile(target);
			if (hashVersionBytes(current) === hash) continue;
		}
		yield* filesystemWrite.replaceFileFx({
			lock,
			target,
			bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
		});
	}
	for (const [hash, bytes] of [
		...plan.pngObjects,
	].sort(([left], [right]) => left.localeCompare(right))) {
		const target = yield* paths.pngObjectFileFx(hash);
		if (yield* fileSystem.exists(target)) {
			const current = yield* fileSystem.readFile(target);
			if (hashVersionBytes(current) === hash) continue;
		}
		yield* filesystemWrite.replaceFileFx({
			lock,
			target,
			bytes,
		});
	}
	return {
		manifest: plan.manifest,
		contentFingerprint: plan.contentFingerprint,
	} satisfies createVersionSnapshotFx.Success;
});
