import { Effect, FileSystem, Path } from "effect";

import { FilesystemWriteError } from "../FilesystemWriteError";
import { FilesystemWriteRecordSchema, type FilesystemWriteRecord } from "./FilesystemWriteRecord";
import type { FilesystemWritePaths } from "./readFilesystemWritePathsFx";
import { syncFilesystemPathFx } from "./syncFilesystemPathFx";

const failRecovery = (recovery: string, message: string, cause?: unknown) =>
	new FilesystemWriteError({
		operation: "recover",
		message,
		recovery,
		cause,
	});

const assertCanonicalFx = Effect.fn("recoverFilesystemWriteFx.assertCanonicalFx")(function* ({
	target,
	type,
}: {
	readonly target: string;
	readonly type: "Directory" | "File";
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (!(yield* fileSystem.exists(target))) return false;
	const info = yield* fileSystem.stat(target);
	if (info.type !== type || (yield* fileSystem.realPath(target)) !== target)
		return yield* Effect.fail(
			failRecovery(target, `Filesystem write recovery path ${target} is not canonical.`),
		);
	return true;
});

const readRecordFx = Effect.fn("recoverFilesystemWriteFx.readRecordFx")(function* (active: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const recordFile = `${active}/record.json`;
	if (!(yield* fileSystem.exists(recordFile))) {
		const entries = (yield* fileSystem.readDirectory(active)).sort();
		if (entries.length === 0 || entries.every((entry) => entry === "record.pending"))
			return undefined;
		return yield* Effect.fail(
			failRecovery(
				active,
				`Filesystem write recovery record ${recordFile} is missing; preserved ${active}.`,
			),
		);
	}
	yield* assertCanonicalFx({
		target: recordFile,
		type: "File",
	});
	const source = yield* fileSystem.readFileString(recordFile);
	return yield* Effect.try({
		try: () => FilesystemWriteRecordSchema.parse(JSON.parse(source)),
		catch: (cause) =>
			failRecovery(
				active,
				`Filesystem write recovery record ${recordFile} is invalid; preserved ${active}.`,
				cause,
			),
	});
});

const assertRecordFx = Effect.fn("recoverFilesystemWriteFx.assertRecordFx")(function* ({
	paths,
	record,
}: {
	readonly paths: FilesystemWritePaths;
	readonly record: FilesystemWriteRecord;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = path.resolve(record.root);
	if (
		root !== record.root ||
		!(yield* fileSystem.exists(root)) ||
		(yield* fileSystem.realPath(root)) !== root ||
		(yield* fileSystem.stat(root)).type !== "Directory"
	)
		return yield* Effect.fail(
			failRecovery(paths.active, `Filesystem write recovery root ${record.root} is unsafe.`),
		);
	const lockRelative = path.relative(root, paths.lock);
	if (lockRelative.startsWith("..") || path.isAbsolute(lockRelative))
		return yield* Effect.fail(
			failRecovery(
				paths.active,
				`Filesystem write recovery lock ${paths.lock} escaped ${root}.`,
			),
		);
	const targets = new Set<string>();
	for (const entry of [
		...record.writes,
		...record.deletes,
	]) {
		const relative = path.relative(root, entry.target);
		if (
			entry.target !== path.resolve(entry.target) ||
			relative === "" ||
			relative.startsWith("..") ||
			path.isAbsolute(relative) ||
			path.dirname(entry.backup) !== paths.active ||
			targets.has(entry.target)
		)
			return yield* Effect.fail(
				failRecovery(
					paths.active,
					`Filesystem write recovery target ${entry.target} is unsafe.`,
				),
			);
		targets.add(entry.target);
		const parent = path.dirname(entry.target);
		if (
			!(yield* fileSystem.exists(parent)) ||
			(yield* fileSystem.realPath(parent)) !== parent ||
			(yield* fileSystem.stat(parent)).type !== "Directory"
		)
			return yield* Effect.fail(
				failRecovery(paths.active, `Filesystem write recovery parent ${parent} is unsafe.`),
			);
		if (yield* fileSystem.exists(entry.target))
			yield* assertCanonicalFx({
				target: entry.target,
				type: "File",
			});
		if (yield* fileSystem.exists(entry.backup))
			yield* assertCanonicalFx({
				target: entry.backup,
				type: "File",
			});
	}
	for (const entry of record.writes) {
		if (path.dirname(entry.pending) !== path.dirname(entry.target))
			return yield* Effect.fail(
				failRecovery(
					paths.active,
					`Filesystem write staging file ${entry.pending} is unsafe.`,
				),
			);
		for (const candidate of [
			entry.pending,
			`${entry.pending}.restore`,
		]) {
			if (yield* fileSystem.exists(candidate))
				yield* assertCanonicalFx({
					target: candidate,
					type: "File",
				});
		}
	}
	return record;
});

const removeCleanupFx = Effect.fn("recoverFilesystemWriteFx.removeCleanupFx")(function* (
	paths: FilesystemWritePaths,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (!(yield* fileSystem.exists(paths.cleanup))) return;
	yield* assertCanonicalFx({
		target: paths.cleanup,
		type: "Directory",
	});
	yield* fileSystem.remove(paths.cleanup, {
		recursive: true,
	});
	yield* syncFilesystemPathFx(paths.parent);
});

const removeTreeFx = Effect.fn("recoverFilesystemWriteFx.removeTreeFx")(function* (
	paths: FilesystemWritePaths,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* removeCleanupFx(paths);
	if (!(yield* fileSystem.exists(paths.active))) return;
	yield* fileSystem.rename(paths.active, paths.cleanup);
	yield* syncFilesystemPathFx(paths.parent);
	yield* fileSystem.remove(paths.cleanup, {
		recursive: true,
	});
	yield* syncFilesystemPathFx(paths.parent);
});

const restoreFx = Effect.fn("recoverFilesystemWriteFx.restoreFx")(function* ({
	paths,
	record,
}: {
	readonly paths: FilesystemWritePaths;
	readonly record: FilesystemWriteRecord;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const parents = new Set<string>();
	for (const entry of [
		...record.writes.filter(({ hadTarget }) => hadTarget),
		...record.deletes,
	])
		if (!(yield* fileSystem.exists(entry.backup)))
			return yield* Effect.fail(
				failRecovery(
					paths.active,
					`Filesystem write recovery backup ${entry.backup} is missing; preserved ${paths.active}.`,
				),
			);
	for (const entry of record.writes) {
		parents.add(path.dirname(entry.target));
		if (!entry.hadTarget) continue;
		const restore = `${entry.pending}.restore`;
		yield* fileSystem.remove(restore, {
			force: true,
		});
		yield* fileSystem.copyFile(entry.backup, restore);
		yield* fileSystem.chmod(restore, entry.oldMode ?? 0o600);
		yield* syncFilesystemPathFx(restore);
	}
	for (const entry of record.deletes) {
		parents.add(path.dirname(entry.target));
		const restore = `${entry.target}.arkini-restore`;
		yield* fileSystem.remove(restore, {
			force: true,
		});
		yield* fileSystem.copyFile(entry.backup, restore);
		yield* fileSystem.chmod(restore, entry.oldMode ?? 0o600);
		yield* syncFilesystemPathFx(restore);
	}
	for (const entry of record.writes)
		if (entry.hadTarget) yield* fileSystem.rename(`${entry.pending}.restore`, entry.target);
		else
			yield* fileSystem.remove(entry.target, {
				force: true,
			});
	for (const entry of record.deletes)
		yield* fileSystem.rename(`${entry.target}.arkini-restore`, entry.target);
	for (const parent of parents) yield* syncFilesystemPathFx(parent);
});

/** Restores an interrupted exact-file write or finishes its committed cleanup. */
export const recoverFilesystemWriteFx = Effect.fn("recoverFilesystemWriteFx")(function* (
	paths: FilesystemWritePaths,
) {
	return yield* Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		yield* removeCleanupFx(paths);
		if (!(yield* fileSystem.exists(paths.active))) return;
		yield* assertCanonicalFx({
			target: paths.active,
			type: "Directory",
		});
		const record = yield* readRecordFx(paths.active);
		if (record === undefined) {
			yield* removeTreeFx(paths);
			return;
		}
		yield* assertRecordFx({
			paths,
			record,
		});
		const committed = yield* fileSystem.exists(`${paths.active}/committed`);
		const writing = yield* fileSystem.exists(`${paths.active}/writing`);
		if (writing && !committed)
			yield* restoreFx({
				paths,
				record,
			});
		for (const entry of record.writes) {
			yield* fileSystem.remove(entry.pending, {
				force: true,
			});
			yield* fileSystem.remove(`${entry.pending}.restore`, {
				force: true,
			});
		}
		yield* removeTreeFx(paths);
	}).pipe(
		Effect.catch((cause) => {
			if (cause instanceof FilesystemWriteError) return Effect.fail(cause);
			return Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const cleanupExists = yield* fileSystem
					.exists(paths.cleanup)
					.pipe(Effect.orElseSucceed(() => false));
				const recovery = cleanupExists ? paths.cleanup : paths.active;
				return yield* Effect.fail(
					new FilesystemWriteError({
						operation: "recover",
						message: `Filesystem write recovery failed; preserved ${recovery}.`,
						cause,
						recovery,
					}),
				);
			});
		}),
	);
});
