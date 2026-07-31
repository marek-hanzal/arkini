import { Clock, FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join, relative } from "node:path";

import { EditorProjectFileSchema } from "../../contract/editor/EditorProjectFile";
import { EditorProjectManifestSchema } from "../../contract/editor/EditorProjectManifest";
import {
	EditorProjectWriteSchema,
	type EditorProjectWrite as EditorProjectWriteContract,
} from "../../contract/editor/EditorProjectWrite";
import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectFilePathFx } from "./assertEditorProjectFilePathFx";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";
import { commitEditorProjectFilesFx } from "./internal/commitEditorProjectFilesFx";
import { readEditorProjectFx } from "./readEditorProjectFx";

export namespace writeEditorProjectFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly mutation: EditorProjectWriteContract;
	}
}

/**
 * Commits one canonical project mutation, touches editor.json, and returns the
 * exact post-write project snapshot from disk.
 */
export const writeEditorProjectFx = Effect.fn("writeEditorProjectFx")(function* ({
	root,
	fileSystem,
	mutation,
}: writeEditorProjectFx.Props) {
	const parsedMutation = yield* Effect.try({
		try: () => EditorProjectWriteSchema.parse(mutation),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause,
			}),
	});
	const projectId = yield* assertEditorProjectIdFx(parsedMutation.projectId);
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
	const record = yield* readEditorProjectFx({
		root,
		fileSystem,
		projectId,
	});
	if (record === null) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error(`Editor project ${projectId} disappeared before validation.`),
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

	const manifestTarget = join(projectRoot, "editor.json");
	yield* commitEditorProjectFilesFx({
		fileSystem,
		content: {
			target,
			bytes: file.bytes,
		},
		manifest: {
			target: manifestTarget,
			bytes: nextManifestFile.bytes,
		},
	});
	const nextRecord = yield* readEditorProjectFx({
		root,
		fileSystem,
		projectId,
	});
	if (nextRecord === null) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project",
				cause: new Error(`Editor project ${projectId} disappeared after its write.`),
			}),
		);
	}
	return nextRecord;
});
