import { Effect, FileSystem, Path } from "effect";

import { FilesystemWriteError } from "../FilesystemWriteError";
import { isFilesystemPathSafeFx } from "../isFilesystemPathSafeFx";
import { FilesystemWriteRecordSchema, type FilesystemWriteRecord } from "./FilesystemWriteRecord";
import type { FilesystemWritePaths } from "./readFilesystemWritePathsFx";

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
	root,
}: {
	readonly target: string;
	readonly type: "Directory" | "File";
	readonly root: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (!(yield* fileSystem.exists(target))) return false;
	const info = yield* fileSystem.stat(target);
	if (info.type !== type || !(yield* isFilesystemPathSafeFx(fileSystem, root, target)))
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
		root: active,
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
		(yield* fileSystem.stat(root)).type !== "Directory" ||
		!(yield* isFilesystemPathSafeFx(fileSystem, root, root))
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
			(yield* fileSystem.stat(parent)).type !== "Directory" ||
			!(yield* isFilesystemPathSafeFx(fileSystem, root, parent))
		)
			return yield* Effect.fail(
				failRecovery(paths.active, `Filesystem write recovery parent ${parent} is unsafe.`),
			);
		if (yield* fileSystem.exists(entry.target))
			yield* assertCanonicalFx({
				root,
				target: entry.target,
				type: "File",
			});
		if (yield* fileSystem.exists(entry.backup))
			yield* assertCanonicalFx({
				root: paths.active,
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
					root,
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
		root: paths.parent,
		target: paths.cleanup,
		type: "Directory",
	});
	yield* fileSystem.remove(paths.cleanup, {
		recursive: true,
	});
});

const removeTreeFx = Effect.fn("recoverFilesystemWriteFx.removeTreeFx")(function* (
	paths: FilesystemWritePaths,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* removeCleanupFx(paths);
	if (!(yield* fileSystem.exists(paths.active))) return;
	yield* fileSystem.rename(paths.active, paths.cleanup);
	yield* fileSystem.remove(paths.cleanup, {
		recursive: true,
	});
});

const restoreFx = Effect.fn("recoverFilesystemWriteFx.restoreFx")(function* ({
	paths,
	record,
}: {
	readonly paths: FilesystemWritePaths;
	readonly record: FilesystemWriteRecord;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
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
		if (!entry.hadTarget) continue;
		const restore = `${entry.pending}.restore`;
		yield* fileSystem.remove(restore, {
			force: true,
		});
		yield* fileSystem.copyFile(entry.backup, restore);
	}
	for (const entry of record.deletes) {
		const restore = `${entry.target}.arkini-restore`;
		yield* fileSystem.remove(restore, {
			force: true,
		});
		yield* fileSystem.copyFile(entry.backup, restore);
	}
	for (const entry of record.writes)
		if (entry.hadTarget) yield* fileSystem.rename(`${entry.pending}.restore`, entry.target);
		else
			yield* fileSystem.remove(entry.target, {
				force: true,
			});
	for (const entry of record.deletes)
		yield* fileSystem.rename(`${entry.target}.arkini-restore`, entry.target);
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
			root: paths.parent,
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
