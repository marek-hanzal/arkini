import { FileSystem } from "effect";
import { Effect, Exit } from "effect";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { ElectronMainError } from "../../ElectronMainError";

interface CommitFile {
	readonly bytes: Uint8Array;
	readonly target: string;
}

interface StagedFile extends CommitFile {
	readonly backup: string;
	readonly pending: string;
	backedUp: boolean;
	published: boolean;
}

export namespace commitEditorProjectFilesFx {
	export interface Props {
		readonly content: CommitFile;
		readonly fileSystem: FileSystem.FileSystem;
		readonly manifest: CommitFile;
	}
}

const ignoreFailure = <A, E>(effect: Effect.Effect<A, E>) =>
	effect.pipe(
		Effect.asVoid,
		Effect.catchCause(() => Effect.void),
	);

const publishEditorProjectFileFx = Effect.fn("publishEditorProjectFileFx")(function* (
	fileSystem: FileSystem.FileSystem,
	file: StagedFile,
) {
	if (yield* fileSystem.exists(file.target)) {
		yield* fileSystem.copyFile(file.target, file.backup);
		file.backedUp = true;
	}
	yield* fileSystem.rename(file.pending, file.target);
	file.published = true;
});

/** Restores the preceding target while preserving its backup if restoration fails. */
const restoreEditorProjectFileFx = Effect.fn("restoreEditorProjectFileFx")(function* (
	fileSystem: FileSystem.FileSystem,
	file: StagedFile,
) {
	if (file.backedUp) {
		yield* fileSystem.rename(file.backup, file.target);
		file.backedUp = false;
		file.published = false;
	} else if (file.published) {
		yield* fileSystem.remove(file.target, {
			force: true,
		});
		file.published = false;
	}
});

const cleanupPendingFilesFx = (
	fileSystem: FileSystem.FileSystem,
	files: ReadonlyArray<StagedFile>,
) =>
	Effect.forEach(
		files,
		(file) =>
			ignoreFailure(
				fileSystem.remove(file.pending, {
					force: true,
				}),
			),
		{
			concurrency: 1,
			discard: true,
		},
	);

const cleanupPublishedBackupsFx = (
	fileSystem: FileSystem.FileSystem,
	files: ReadonlyArray<StagedFile>,
) =>
	Effect.forEach(
		files,
		(file) =>
			ignoreFailure(
				fileSystem.remove(file.backup, {
					force: true,
				}),
			),
		{
			concurrency: 1,
			discard: true,
		},
	);

/** Publishes one content file and editor.json together with rollback on runtime failure. */
export const commitEditorProjectFilesFx = Effect.fn("commitEditorProjectFilesFx")(function* ({
	content,
	fileSystem,
	manifest,
}: commitEditorProjectFilesFx.Props) {
	const token = randomUUID();
	const contentDirectory = dirname(content.target);
	const manifestDirectory = dirname(manifest.target);
	const stagedContent: StagedFile = {
		...content,
		backup: join(contentDirectory, `.${token}.backup`),
		pending: join(contentDirectory, `.${token}.pending`),
		backedUp: false,
		published: false,
	};
	const stagedManifest: StagedFile = {
		...manifest,
		backup: join(manifestDirectory, `.${token}.manifest.backup`),
		pending: join(manifestDirectory, `.${token}.manifest.pending`),
		backedUp: false,
		published: false,
	};
	const stagedFiles = [
		stagedContent,
		stagedManifest,
	] as const;

	const stageExit = yield* Effect.exit(
		Effect.all(
			[
				fileSystem.writeFile(stagedContent.pending, content.bytes),
				fileSystem.writeFile(stagedManifest.pending, manifest.bytes),
			],
			{
				concurrency: 1,
			},
		),
	);
	if (Exit.isFailure(stageExit)) {
		yield* cleanupPendingFilesFx(fileSystem, stagedFiles);
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Commit Arkini editor project files",
				cause: stageExit.cause,
			}),
		);
	}

	const contentExit = yield* Effect.exit(publishEditorProjectFileFx(fileSystem, stagedContent));
	if (Exit.isFailure(contentExit)) {
		yield* ignoreFailure(restoreEditorProjectFileFx(fileSystem, stagedContent));
		yield* cleanupPendingFilesFx(fileSystem, stagedFiles);
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Commit Arkini editor project files",
				cause: contentExit.cause,
			}),
		);
	}

	const manifestExit = yield* Effect.exit(publishEditorProjectFileFx(fileSystem, stagedManifest));
	if (Exit.isFailure(manifestExit)) {
		// Restore content before the manifest so editor.json remains the commit marker.
		yield* ignoreFailure(restoreEditorProjectFileFx(fileSystem, stagedContent));
		yield* ignoreFailure(restoreEditorProjectFileFx(fileSystem, stagedManifest));
		yield* cleanupPendingFilesFx(fileSystem, stagedFiles);
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Commit Arkini editor project files",
				cause: manifestExit.cause,
			}),
		);
	}

	yield* cleanupPublishedBackupsFx(fileSystem, stagedFiles);
});
