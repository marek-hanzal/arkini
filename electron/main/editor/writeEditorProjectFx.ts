import { Clock, FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join, relative } from "node:path";

import { EditorProjectFileSchema } from "../../contract/editor/EditorProjectFile";
import { EditorProjectManifestSchema } from "../../contract/editor/EditorProjectManifest";
import {
	EditorProjectRecordSchema,
	type EditorProjectRecord,
} from "../../contract/editor/EditorProjectRecord";
import {
	EditorProjectWriteSchema,
	type EditorProjectWrite as EditorProjectWriteContract,
} from "../../contract/editor/EditorProjectWrite";
import {
	EditorProjectWriteResultSchema,
	type EditorProjectWriteResult,
} from "../../contract/editor/EditorProjectWriteResult";
import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectFilePathFx } from "./assertEditorProjectFilePathFx";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";
import { commitEditorProjectFilesFx } from "./internal/commitEditorProjectFilesFx";
import { readEditorProjectRevisionFx } from "./readEditorProjectRevisionFx";

export namespace writeEditorProjectFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly mutation: EditorProjectWriteContract;
		readonly record: EditorProjectRecord;
	}

	export interface Result {
		readonly record: EditorProjectRecord;
		readonly write: EditorProjectWriteResult;
	}
}

/**
 * Commits one canonical project delta against the already loaded in-memory index.
 * The filesystem is only written; it is never rescanned after the initial load.
 */
export const writeEditorProjectFx = Effect.fn("writeEditorProjectFx")(function* ({
	root,
	fileSystem,
	mutation,
	record: candidateRecord,
}: writeEditorProjectFx.Props) {
	const parsedMutation = yield* Effect.try({
		try: () => EditorProjectWriteSchema.parse(mutation),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause,
			}),
	});
	const record = yield* Effect.try({
		try: () => EditorProjectRecordSchema.parse(candidateRecord),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause,
			}),
	});
	const projectId = yield* assertEditorProjectIdFx(parsedMutation.projectId);
	if (record.projectId !== projectId) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error(
					`Loaded editor project ${record.projectId} does not match mutation ${projectId}.`,
				),
			}),
		);
	}
	const file = EditorProjectFileSchema.parse(parsedMutation.file);
	const portablePath = yield* assertEditorProjectFilePathFx(file.path);
	if (portablePath.toLowerCase() === "editor.json") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error("editor.json is owned by the canonical project writer."),
			}),
		);
	}
	if (record.revision !== parsedMutation.expectedRevision) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error(
					`Editor project ${projectId} changed after this mutation was validated.`,
				),
			}),
		);
	}
	const existing = record.files.find(
		({ path }) => path.toLowerCase() === portablePath.toLowerCase(),
	);
	if (
		(parsedMutation.mode === "create" && existing !== undefined) ||
		(parsedMutation.mode === "replace" && existing?.path !== portablePath)
	) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error(
					parsedMutation.mode === "create"
						? `Editor project path ${portablePath} already exists.`
						: `Editor project path ${portablePath} is not the exact source being replaced.`,
				),
			}),
		);
	}

	const manifestFile = record.files.find(({ path }) => path === "editor.json");
	const manifest = yield* Effect.try({
		try: () =>
			EditorProjectManifestSchema.parse(
				JSON.parse(
					new TextDecoder().decode(manifestFile?.bytes ?? new Uint8Array()),
				) as unknown,
			),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause,
			}),
	});
	const nowMs = yield* Clock.currentTimeMillis;
	const nextManifest = EditorProjectManifestSchema.parse({
		...manifest,
		updatedAtMs: Math.max(nowMs, manifest.updatedAtMs + 1),
	});
	const nextManifestFile = EditorProjectFileSchema.parse({
		path: "editor.json",
		bytes: new TextEncoder().encode(`${JSON.stringify(nextManifest, null, "\t")}\n`),
	});

	const projectRoot = yield* fileSystem.realPath(join(root, projectId));
	const target = join(projectRoot, ...portablePath.split("/"));
	const targetDirectory = dirname(target);
	yield* fileSystem.makeDirectory(targetDirectory, {
		recursive: true,
	});
	const canonicalDirectory = yield* fileSystem.realPath(targetDirectory);
	if (relative(targetDirectory, canonicalDirectory) !== "") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error(`Editor project path ${portablePath} resolves through a symlink.`),
			}),
		);
	}
	if (yield* fileSystem.exists(target)) {
		const canonicalTarget = yield* fileSystem.realPath(target);
		const info = yield* fileSystem.stat(canonicalTarget);
		if (info.type !== "File" || relative(target, canonicalTarget) !== "") {
			return yield* Effect.fail(
				new ElectronMainError({
					operation: "Write Arkini editor project",
					cause: new Error(
						`Editor project path ${portablePath} is not a canonical contained file.`,
					),
				}),
			);
		}
	}

	const persistedFile = EditorProjectFileSchema.parse({
		path: portablePath,
		bytes: file.bytes,
	});
	const nextFiles = [
		...record.files.filter(
			({ path }) => path !== "editor.json" && path.toLowerCase() !== portablePath.toLowerCase(),
		),
		persistedFile,
		nextManifestFile,
	];
	const revision = yield* readEditorProjectRevisionFx({
		projectId,
		files: nextFiles,
	});
	const nextRecord = EditorProjectRecordSchema.parse({
		projectId,
		files: nextFiles,
		revision,
	});

	yield* commitEditorProjectFilesFx({
		fileSystem,
		content: {
			target,
			bytes: persistedFile.bytes,
		},
		manifest: {
			target: join(projectRoot, "editor.json"),
			bytes: nextManifestFile.bytes,
		},
	});
	return {
		record: nextRecord,
		write: EditorProjectWriteResultSchema.parse({
			projectId,
			file: persistedFile,
			manifest: nextManifestFile,
			revision,
		}),
	} satisfies writeEditorProjectFx.Result;
});
