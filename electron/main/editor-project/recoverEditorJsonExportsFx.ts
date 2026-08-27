import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import {
	assertCanonicalEditorJsonExportArtifactFx,
	assertCanonicalEditorJsonExportRecoveryDirectoryFx,
	EditorJsonExportCleanupSuffix,
	isOwnedEditorJsonExportTargetFx,
	readEditorJsonExportRecoveryPaths,
	readEditorJsonExportRecoveryRecordFx,
	type EditorJsonExportRecoveryRecord,
} from "./EditorJsonExportRecoveryRecord";

const writeRecoveryMarkerFx = Effect.fn("writeEditorJsonExportRecoveryMarkerFx")(function* (
	recoveryDirectory: string,
	name: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const target = path.join(recoveryDirectory, name);
	yield* fileSystem.writeFileString(target, "1", {
		flag: "wx",
		mode: 0o600,
	});
	yield* syncFilesystemPathFx(fileSystem, target);
	yield* syncFilesystemPathFx(fileSystem, recoveryDirectory);
});

const syncRestoredTreeFx = Effect.fn("syncRestoredEditorJsonExportTreeFx")(function* (
	root: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const directories = [
		root,
	];
	for (const entry of yield* fileSystem.readDirectory(root, {
		recursive: true,
	})) {
		const target = path.join(root, entry);
		const info = yield* fileSystem.stat(target);
		if (info.type === "File") yield* syncFilesystemPathFx(fileSystem, target);
		else if (info.type === "Directory") directories.push(target);
		else if (info.type !== "SymbolicLink")
			return yield* Effect.fail(
				new Error(`Editor export recovery artifact ${target} cannot be restored durably.`),
			);
	}
	for (const directory of directories.sort((left, right) => right.length - left.length))
		yield* syncFilesystemPathFx(fileSystem, directory);
});

const cleanupTerminalFx = Effect.fn("cleanupTerminalEditorJsonExportFx")(function* (
	recoveryDirectory: string,
	record: EditorJsonExportRecoveryRecord,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const recoveryRoot = path.dirname(recoveryDirectory);
	const paths = readEditorJsonExportRecoveryPaths(path, record);
	if (yield* isOwnedEditorJsonExportTargetFx(paths.marker, record.transaction)) {
		yield* fileSystem.remove(paths.marker);
		yield* syncFilesystemPathFx(fileSystem, record.target);
	}
	for (const artifact of [
		paths.pending,
		paths.previous,
		paths.restore,
	]) {
		if (yield* assertCanonicalEditorJsonExportArtifactFx(artifact))
			yield* fileSystem.remove(artifact, {
				recursive: true,
			});
	}
	yield* syncFilesystemPathFx(fileSystem, paths.parent);
	yield* fileSystem.remove(recoveryDirectory, {
		recursive: true,
	});
	yield* syncFilesystemPathFx(fileSystem, recoveryRoot);
});

const finishActiveFx = Effect.fn("finishActiveEditorJsonExportFx")(function* (
	recoveryDirectory: string,
	record: EditorJsonExportRecoveryRecord,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const cleanupDirectory = `${recoveryDirectory}${EditorJsonExportCleanupSuffix}`;
	if (yield* fileSystem.exists(cleanupDirectory))
		return yield* Effect.fail(
			new Error(`Editor export cleanup entry ${cleanupDirectory} already exists.`),
		);
	yield* fileSystem.rename(recoveryDirectory, cleanupDirectory);
	yield* syncFilesystemPathFx(fileSystem, path.dirname(recoveryDirectory));
	yield* cleanupTerminalFx(cleanupDirectory, record);
});

const recoverActiveFx = Effect.fn("recoverActiveEditorJsonExportFx")(function* (
	recoveryDirectory: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const record = yield* readEditorJsonExportRecoveryRecordFx(recoveryDirectory);
	const paths = readEditorJsonExportRecoveryPaths(path, record);
	for (const artifact of [
		paths.pending,
		paths.previous,
		paths.restore,
	])
		yield* assertCanonicalEditorJsonExportArtifactFx(artifact);
	const committed = yield* fileSystem.exists(path.join(recoveryDirectory, "committed"));
	const publishing = yield* fileSystem.exists(path.join(recoveryDirectory, "publishing"));
	if (committed && !(yield* fileSystem.exists(record.target)))
		return yield* Effect.fail(
			new Error(`Committed Editor export target ${record.target} is missing.`),
		);
	if (!committed && publishing) {
		if (record.hadTarget) {
			if (yield* fileSystem.exists(paths.previous)) {
				const restoringMarker = path.join(recoveryDirectory, "restoring");
				if (!(yield* fileSystem.exists(restoringMarker))) {
					if (
						(yield* fileSystem.exists(record.target)) &&
						!(yield* isOwnedEditorJsonExportTargetFx(paths.marker, record.transaction))
					)
						return yield* Effect.fail(
							new Error(
								`Editor export recovery target ${record.target} is not owned.`,
							),
						);
					yield* fileSystem.copy(paths.previous, paths.restore, {
						overwrite: true,
						preserveTimestamps: true,
					});
					yield* assertCanonicalEditorJsonExportArtifactFx(paths.restore);
					yield* syncRestoredTreeFx(paths.restore);
					yield* syncFilesystemPathFx(fileSystem, paths.parent);
					yield* writeRecoveryMarkerFx(recoveryDirectory, "restoring");
				}
				const restoreExists = yield* fileSystem.exists(paths.restore);
				const targetExists = yield* fileSystem.exists(record.target);
				const targetOwned =
					targetExists &&
					(yield* isOwnedEditorJsonExportTargetFx(paths.marker, record.transaction));
				if (targetExists && !targetOwned && restoreExists)
					return yield* Effect.fail(
						new Error(`Editor export recovery target ${record.target} is not owned.`),
					);
				if (targetOwned && !restoreExists)
					return yield* Effect.fail(
						new Error(`Editor export recovery artifact ${paths.restore} is missing.`),
					);
				if (targetExists && restoreExists)
					yield* fileSystem.remove(record.target, {
						recursive: true,
					});
				if (restoreExists) yield* fileSystem.rename(paths.restore, record.target);
				else if (!targetExists)
					return yield* Effect.fail(
						new Error(`Editor export recovery target ${record.target} is missing.`),
					);
				yield* syncFilesystemPathFx(fileSystem, paths.parent);
			} else if (yield* fileSystem.exists(path.join(recoveryDirectory, "moved"))) {
				return yield* Effect.fail(
					new Error(`Editor export recovery backup ${paths.previous} is missing.`),
				);
			} else if (!(yield* fileSystem.exists(record.target))) {
				return yield* Effect.fail(
					new Error(`Editor export recovery target ${record.target} is missing.`),
				);
			}
		} else if (yield* fileSystem.exists(record.target)) {
			const owned = yield* isOwnedEditorJsonExportTargetFx(paths.marker, record.transaction);
			if (!owned)
				return yield* Effect.fail(
					new Error(`Editor export recovery target ${record.target} is not owned.`),
				);
			yield* fileSystem.remove(record.target, {
				recursive: true,
			});
			yield* syncFilesystemPathFx(fileSystem, paths.parent);
		}
	}
	yield* finishActiveFx(recoveryDirectory, record);
});

/** Resolves one known transaction after a failed publication attempt. */
export const recoverOneEditorJsonExportFx = recoverActiveFx;

/** Restores or finishes every interrupted directory export before another Save as dialog opens. */
export const recoverEditorJsonExportsFx = Effect.fn("recoverEditorJsonExportsFx")(function* (
	recoveryRoot: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fileSystem.exists(recoveryRoot))) return;
	for (const entry of (yield* fileSystem.readDirectory(recoveryRoot)).sort()) {
		if (entry === "recovery.lock") continue;
		const recoveryDirectory = path.join(recoveryRoot, entry);
		if (entry.endsWith(EditorJsonExportCleanupSuffix)) {
			yield* assertCanonicalEditorJsonExportRecoveryDirectoryFx(recoveryDirectory);
			if (!(yield* fileSystem.exists(path.join(recoveryDirectory, "record.json")))) {
				yield* fileSystem.remove(recoveryDirectory, {
					recursive: true,
				});
				yield* syncFilesystemPathFx(fileSystem, recoveryRoot);
				continue;
			}
			const record = yield* readEditorJsonExportRecoveryRecordFx(recoveryDirectory);
			yield* cleanupTerminalFx(recoveryDirectory, record);
		} else {
			yield* recoverActiveFx(recoveryDirectory);
		}
	}
});
