import { FileSystem } from "effect";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import { dirname, join, relative } from "node:path";

import { EditorProjectFileSchema } from "../../contract/editor/EditorProjectFile";
import {
	EditorProjectFileWriteSchema,
	type EditorProjectFileWrite as EditorProjectFileWriteContract,
} from "../../contract/editor/EditorProjectFileWrite";
import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectFilePathFx } from "./assertEditorProjectFilePathFx";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";
import { readEditorProjectFx } from "./readEditorProjectFx";
import { readEditorProjectRevision } from "./readEditorProjectRevision";

export namespace writeEditorProjectFileFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly mutation: EditorProjectFileWriteContract;
	}
}

/** Atomically replaces or creates one validated source file inside an existing project. */
export const writeEditorProjectFileFx = Effect.fn("writeEditorProjectFileFx")(function* ({
	root,
	fileSystem,
	mutation,
}: writeEditorProjectFileFx.Props) {
	const parsedMutation = yield* Effect.try({
		try: () => EditorProjectFileWriteSchema.parse(mutation),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Write Arkini editor project file",
				cause,
			}),
	});
	const projectId = yield* assertEditorProjectIdFx(parsedMutation.projectId);
	const file = EditorProjectFileSchema.parse(parsedMutation.file);
	const portablePath = yield* assertEditorProjectFilePathFx(file.path);
	const record = yield* readEditorProjectFx({
		root,
		fileSystem,
		projectId,
	});
	if (record === null) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project file",
				cause: new Error(`Editor project ${projectId} disappeared before validation.`),
			}),
		);
	}
	if (record.revision !== parsedMutation.expectedRevision) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Write Arkini editor project file",
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
				operation: "Write Arkini editor project file",
				cause: new Error(
					parsedMutation.mode === "create"
						? `Editor project path ${portablePath} already exists.`
						: `Editor project path ${portablePath} is not the exact source being replaced.`,
				),
			}),
		);
	}

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
				operation: "Write Arkini editor project file",
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
					operation: "Write Arkini editor project file",
					cause: new Error(
						`Editor project path ${portablePath} is not a canonical contained file.`,
					),
				}),
			);
		}
	}

	const pending = join(targetDirectory, `.${randomUUID()}.pending`);
	yield* Effect.gen(function* () {
		yield* fileSystem.writeFile(pending, file.bytes);
		yield* fileSystem.rename(pending, target);
	}).pipe(
		Effect.ensuring(
			fileSystem
				.remove(pending, {
					force: true,
				})
				.pipe(Effect.orElseSucceed(() => void 0)),
		),
		Effect.mapError(
			(cause) =>
				new ElectronMainError({
					operation: "Write Arkini editor project file",
					cause,
				}),
		),
	);
	return readEditorProjectRevision({
		projectId,
		files: [
			...record.files.filter(({ path }) => path !== portablePath),
			file,
		],
	});
});
