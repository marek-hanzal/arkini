import { randomUUID } from "node:crypto";
import { Effect, Exit, FileSystem, Path } from "effect";

import type { FilesystemWrite } from "../FilesystemWrite";
import { FilesystemWriteError } from "../FilesystemWriteError";
import type { FilesystemWriteRecord } from "./FilesystemWriteRecord";
import { prepareFilesystemWriteTargetFx } from "./prepareFilesystemWriteTargetFx";
import type { FilesystemWritePaths } from "./readFilesystemWritePathsFx";
import { recoverFilesystemWriteFx } from "./recoverFilesystemWriteFx";
import { syncFilesystemPathFx } from "./syncFilesystemPathFx";
import { writeSyncedFileFx } from "./writeSyncedFileFx";

const encoder = new TextEncoder();

const writeMarkerFx = Effect.fn("writeFilesFx.writeMarkerFx")(function* (target: string) {
	const path = yield* Path.Path;
	yield* writeSyncedFileFx({
		target,
		bytes: Uint8Array.of(1),
		mode: 0o600,
	});
	yield* syncFilesystemPathFx(path.dirname(target));
});

const writeRecordFx = Effect.fn("writeFilesFx.writeRecordFx")(function* ({
	active,
	record,
}: {
	readonly active: string;
	readonly record: FilesystemWriteRecord;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const pending = `${active}/record.pending`;
	yield* writeSyncedFileFx({
		target: pending,
		bytes: encoder.encode(JSON.stringify(record)),
		mode: 0o600,
	});
	yield* fileSystem.rename(pending, `${active}/record.json`);
	yield* syncFilesystemPathFx(active);
});

const mapWriteError = (operation: "write-file" | "write-files", cause: unknown) =>
	cause instanceof FilesystemWriteError
		? cause
		: new FilesystemWriteError({
				operation,
				message:
					operation === "write-file"
						? "The atomic filesystem file write failed."
						: "The recoverable filesystem file-set write failed.",
				cause,
			});

/** Writes one exact owned file set while preserving unrelated root contents. */
export const writeFilesFx = Effect.fn("writeFilesFx")(function* ({
	operation,
	paths,
	props,
}: {
	readonly operation: "write-file" | "write-files";
	readonly paths: FilesystemWritePaths;
	readonly props: FilesystemWrite.Files;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const requestedRoot = path.resolve(props.root);
	if (
		!(yield* fileSystem.exists(requestedRoot)) ||
		(yield* fileSystem.stat(requestedRoot)).type !== "Directory"
	)
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation,
				message: `Filesystem write root ${requestedRoot} must be a directory.`,
			}),
		);
	const root = yield* fileSystem.realPath(requestedRoot);
	const lockRelative = path.relative(root, paths.lock);
	if (lockRelative.startsWith("..") || path.isAbsolute(lockRelative))
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation,
				message: `Filesystem write lock ${paths.lock} must be contained by ${root}.`,
			}),
		);
	if ((yield* fileSystem.stat(root)).dev !== (yield* fileSystem.stat(paths.parent)).dev)
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation,
				message: `Filesystem write lock ${paths.lock} crosses a device boundary.`,
			}),
		);
	if (props.writes.length === 0 && (props.deletes?.length ?? 0) === 0) return;

	const token = randomUUID();
	const targets = new Map<string, string>();
	const prepareTargetFx = Effect.fn("writeFilesFx.prepareTargetFx")(function* (target: string) {
		const prepared = yield* prepareFilesystemWriteTargetFx({
			operation,
			root,
			requestedRoot,
			target,
		});
		if (prepared.target === paths.lock)
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation,
					message: `Filesystem write target ${prepared.target} is the active lock.`,
				}),
			);
		const collision = prepared.target.normalize("NFD").toLowerCase();
		if (targets.has(collision))
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation,
					message: `Filesystem write targets ${targets.get(collision)} and ${prepared.target} collide.`,
				}),
			);
		targets.set(collision, prepared.target);
		return prepared;
	});
	const writes: Array<{
		readonly target: string;
		readonly parent: string;
		readonly bytes: Uint8Array;
		readonly mode?: number;
	}> = [];
	for (const write of props.writes) {
		const prepared = yield* prepareTargetFx(write.target);
		writes.push({
			...prepared,
			bytes: write.bytes,
			...(write.mode === undefined
				? {}
				: {
						mode: write.mode,
					}),
		});
	}
	const deletes: Array<{
		readonly target: string;
		readonly parent: string;
	}> = [];
	for (const target of props.deletes ?? []) {
		const prepared = yield* prepareTargetFx(target);
		if (yield* fileSystem.exists(prepared.target)) deletes.push(prepared);
	}

	const record: FilesystemWriteRecord = {
		version: 1,
		root,
		writes: yield* Effect.forEach(writes, (write, index) =>
			Effect.gen(function* () {
				const exists = yield* fileSystem.exists(write.target);
				const oldInfo = exists ? yield* fileSystem.stat(write.target) : undefined;
				const oldMode = oldInfo === undefined ? undefined : oldInfo.mode & 0o777;
				return {
					target: write.target,
					pending: `${write.target}.${token}.pending`,
					backup: path.join(paths.active, `backup-${index}`),
					hadTarget: exists,
					...(exists
						? {
								oldMode,
							}
						: {}),
					newMode: write.mode ?? oldMode ?? 0o666 & ~process.umask(),
				};
			}),
		),
		deletes: yield* Effect.forEach(deletes, (entry, index) =>
			Effect.gen(function* () {
				const info = yield* fileSystem.stat(entry.target);
				return {
					target: entry.target,
					backup: path.join(paths.active, `backup-${writes.length + index}`),
					hadTarget: true,
					oldMode: info.mode & 0o777,
				};
			}),
		),
	};

	const prepareFx = Effect.gen(function* () {
		yield* fileSystem.makeDirectory(paths.active, {
			mode: 0o700,
		});
		yield* syncFilesystemPathFx(paths.parent);
		yield* writeRecordFx({
			active: paths.active,
			record,
		});
		for (const entry of [
			...record.writes,
			...record.deletes,
		]) {
			if (!entry.hadTarget) continue;
			yield* fileSystem.copyFile(entry.target, entry.backup);
			yield* fileSystem.chmod(entry.backup, entry.oldMode ?? 0o600);
			yield* syncFilesystemPathFx(entry.backup);
		}
		for (let index = 0; index < record.writes.length; index += 1) {
			const entry = record.writes[index];
			yield* writeSyncedFileFx({
				target: entry.pending,
				bytes: writes[index].bytes,
				mode: entry.newMode,
			});
		}
		for (const parent of new Set(writes.map((write) => write.parent)))
			yield* syncFilesystemPathFx(parent);
	});
	const applyFx = Effect.gen(function* () {
		yield* writeMarkerFx(`${paths.active}/writing`);
		for (const entry of record.writes) yield* fileSystem.rename(entry.pending, entry.target);
		for (const entry of record.deletes)
			yield* fileSystem.remove(entry.target, {
				force: true,
			});
		for (const parent of new Set([
			...writes.map((write) => write.parent),
			...deletes.map((entry) => entry.parent),
		]))
			yield* syncFilesystemPathFx(parent);
		yield* writeMarkerFx(`${paths.active}/committed`);
	});

	return yield* Effect.uninterruptibleMask((restore) =>
		restore(prepareFx).pipe(
			Effect.andThen(Effect.uninterruptible(applyFx)),
			Effect.onExit((exit) =>
				Exit.isSuccess(exit)
					? recoverFilesystemWriteFx(paths).pipe(Effect.ignore)
					: recoverFilesystemWriteFx(paths),
			),
		),
	).pipe(Effect.mapError((cause) => mapWriteError(operation, cause)));
});
