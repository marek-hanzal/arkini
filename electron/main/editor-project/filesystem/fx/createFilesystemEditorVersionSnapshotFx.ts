import { Buffer } from "node:buffer";
import { FileSystem } from "effect";
import { Effect } from "effect";

import type { EditorProjectFilesystemPaths } from "../EditorProjectFilesystemPaths";
import { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";
import { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import type { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { hashFilesystemEditorVersionBytes } from "./FilesystemEditorVersionFingerprint";
import { assertFilesystemEditorProjectDirectoryFx } from "./assertFilesystemEditorProjectDirectoryFx";
import { createFilesystemEditorVersionSnapshotPlan } from "./createFilesystemEditorVersionSnapshotPlan";
import { replaceFilesystemEditorFileFx } from "./replaceFilesystemEditorFileFx";
import { replaceFilesystemEditorJsonFx } from "./replaceFilesystemEditorJsonFx";

export namespace createFilesystemEditorVersionSnapshotFx {
	export interface Props {
		readonly arkpack: ArkpackVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly scenarios: ReadonlyArray<EditorBoardScenarioSchema.Type>;
		readonly paths: EditorProjectFilesystemPaths;
	}

	export interface Success {
		readonly manifest: EditorVersionManifestSchema.Type;
		readonly contentFingerprint: string;
	}
}

/** Writes one deduplicated immutable full snapshot without publishing a version. */
export const createFilesystemEditorVersionSnapshotFx = Effect.fn(
	"createFilesystemEditorVersionSnapshotFx",
)(function* ({
	arkpack,
	config,
	resources,
	scenarios,
	paths,
}: createFilesystemEditorVersionSnapshotFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const plan = yield* Effect.try({
		try: () =>
			createFilesystemEditorVersionSnapshotPlan({
				arkpack,
				config,
				resources,
				scenarios: scenarios.map((scenario) => {
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
			}),
		catch: (cause) =>
			new Error("The Editor version snapshot is invalid.", {
				cause,
			}),
	});
	yield* fileSystem.makeDirectory(paths.objects, {
		recursive: true,
	});
	yield* assertFilesystemEditorProjectDirectoryFx({
		root: paths.root,
		directory: paths.objects,
	});
	for (const [hash, value] of [
		...plan.jsonObjects,
	].sort(([left], [right]) => left.localeCompare(right))) {
		const target = yield* paths.jsonObjectFileFx(hash);
		if (yield* fileSystem.exists(target)) {
			const current = yield* fileSystem.readFile(target);
			if (hashFilesystemEditorVersionBytes(current) === hash) continue;
		}
		yield* replaceFilesystemEditorJsonFx(target, value);
	}
	for (const [hash, bytes] of [
		...plan.pngObjects,
	].sort(([left], [right]) => left.localeCompare(right))) {
		const target = yield* paths.pngObjectFileFx(hash);
		if (yield* fileSystem.exists(target)) {
			const current = yield* fileSystem.readFile(target);
			if (hashFilesystemEditorVersionBytes(current) === hash) continue;
		}
		yield* replaceFilesystemEditorFileFx({
			target,
			bytes,
		});
	}
	return {
		manifest: plan.manifest,
		contentFingerprint: plan.contentFingerprint,
	} satisfies createFilesystemEditorVersionSnapshotFx.Success;
});
