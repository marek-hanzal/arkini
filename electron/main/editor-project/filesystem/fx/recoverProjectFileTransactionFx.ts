import { Effect, FileSystem, Path } from "effect";
import { rmdir } from "node:fs/promises";
import { z } from "zod";

import { FilesystemWriteError } from "~/filesystem-write/error/FilesystemWriteError";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { isFilesystemPathSafeFx } from "~/filesystem-write/fx/isFilesystemPathSafeFx";
import { prepareFilesystemWriteTargetFx } from "~/filesystem-write/fx/prepareFilesystemWriteTargetFx";

const recordSchema = z
	.object({
		writes: z.array(
			z
				.object({
					target: z.string().min(1),
					hadTarget: z.boolean(),
				})
				.strict(),
		),
		deletes: z.array(z.string().min(1)),
	})
	.strict();

const failRecoveryFx = Effect.fn("recoverProjectFileTransactionFx.failRecoveryFx")(
	(recovery: string, message: string, cause?: unknown) =>
		Effect.fail(
			new FilesystemWriteError({
				operation: "recover",
				message,
				recovery,
				cause,
			}),
		),
);

const assertFileFx = Effect.fn("recoverProjectFileTransactionFx.assertFileFx")(function* (
	root: string,
	target: string,
	required = false,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (!(yield* isFilesystemPathSafeFx(fileSystem, root, target)))
		return yield* failRecoveryFx(root, `Recovery file ${target} is unsafe.`);
	if (!(yield* fileSystem.exists(target))) {
		if (required) return yield* failRecoveryFx(root, `Recovery file ${target} is missing.`);
		return false;
	}
	if ((yield* fileSystem.stat(target)).type !== "File")
		return yield* failRecoveryFx(root, `Recovery file ${target} is not a file.`);
	return true;
});

const removeFileFx = Effect.fn("recoverProjectFileTransactionFx.removeFileFx")(function* (
	root: string,
	target: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (yield* assertFileFx(root, target))
		yield* fileSystem.remove(target, {
			force: true,
		});
});

const removeEmptyDirectoryFx = Effect.fn("recoverProjectFileTransactionFx.removeEmptyDirectoryFx")(
	(target: string) =>
		Effect.tryPromise({
			try: () => rmdir(target),
			catch: (cause) =>
				new FilesystemWriteError({
					operation: "recover",
					message: `Recovery directory ${target} is not empty.`,
					recovery: target,
					cause,
				}),
		}),
);

/** Restores an interrupted portable Editor current-tree commit or removes its exact journal. */
export const recoverProjectFileTransactionFx = Effect.fn("recoverProjectFileTransactionFx")(
	function* (filesystemWrite: FilesystemWrite, requestedRoot: string) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* fileSystem.realPath(path.resolve(requestedRoot));
		const lock = path.join(root, "editor.lock");
		const active = `${lock}.write`;
		return yield* Effect.gen(function* () {
			if (!(yield* isFilesystemPathSafeFx(fileSystem, root, active)))
				return yield* failRecoveryFx(active, `Recovery directory ${active} is unsafe.`);
			if (!(yield* fileSystem.exists(active))) return;
			if ((yield* fileSystem.stat(active)).type !== "Directory")
				return yield* failRecoveryFx(active, `Recovery path ${active} is not a directory.`);

			const recordFile = path.join(active, "record.json");
			if (!(yield* assertFileFx(active, recordFile))) {
				const entries = yield* fileSystem.readDirectory(active);
				if (entries.length > 1 || (entries.length === 1 && entries[0] !== "record.pending"))
					return yield* failRecoveryFx(
						active,
						`Recovery record ${recordFile} is missing.`,
					);
				if (entries.length === 1)
					yield* removeFileFx(active, path.join(active, entries[0]));
				yield* removeEmptyDirectoryFx(active);
				return;
			}
			const source = yield* fileSystem.readFileString(recordFile);
			const record = yield* Effect.try({
				try: () => recordSchema.parse(JSON.parse(source)),
				catch: (cause) =>
					new FilesystemWriteError({
						operation: "recover",
						message: "Recovery record is invalid.",
						recovery: active,
						cause,
					}),
			});
			const collisions = new Set<string>();
			const resolveFx = Effect.fn("recoverProjectFileTransactionFx.resolveFx")(function* (
				relative: string,
			) {
				const target = path.resolve(root, relative);
				if (path.relative(root, target) !== relative)
					return yield* failRecoveryFx(active, `Recovery target ${relative} is unsafe.`);
				const prepared = yield* prepareFilesystemWriteTargetFx({
					operation: "write-files",
					root,
					requestedRoot: root,
					target,
				});
				if (prepared.target === lock)
					return yield* failRecoveryFx(active, "Recovery targets the active lock.");
				for (const candidate of [
					prepared.target,
					`${prepared.target}.arkini-replace`,
				]) {
					const key = candidate.normalize("NFD").toLowerCase();
					if (collisions.has(key))
						return yield* failRecoveryFx(
							active,
							`Recovery target ${candidate} collides.`,
						);
					collisions.add(key);
				}
				return prepared.target;
			});
			const writes = yield* Effect.forEach(record.writes, ({ target }) => resolveFx(target));
			const deletes = yield* Effect.forEach(record.deletes, resolveFx);
			const allowed = new Set([
				"record.json",
				"writing",
				"committed",
			]);
			for (let index = 0; index < writes.length; index += 1)
				if (record.writes[index].hadTarget) allowed.add(`old-${index}`);
			for (let index = 0; index < deletes.length; index += 1)
				allowed.add(`old-${writes.length + index}`);
			for (const entry of yield* fileSystem.readDirectory(active))
				if (!allowed.has(entry))
					return yield* failRecoveryFx(
						active,
						`Recovery contains unknown file ${entry}.`,
					);

			const writing = yield* assertFileFx(active, path.join(active, "writing"));
			const committed = yield* assertFileFx(active, path.join(active, "committed"));
			if (writing && !committed) {
				const backups = [
					...writes,
					...deletes,
				].map((_, index) => path.join(active, `old-${index}`));
				for (let index = 0; index < writes.length; index += 1)
					if (record.writes[index].hadTarget)
						yield* assertFileFx(active, backups[index], true);
				for (let index = 0; index < deletes.length; index += 1)
					yield* assertFileFx(active, backups[writes.length + index], true);
				for (const target of writes)
					yield* filesystemWrite.removeFileFx({
						lock,
						target: `${target}.arkini-replace`,
					});
				for (let index = 0; index < writes.length; index += 1)
					if (record.writes[index].hadTarget)
						yield* filesystemWrite.replaceFileFx({
							lock,
							target: writes[index],
							bytes: Uint8Array.from(yield* fileSystem.readFile(backups[index])),
						});
					else
						yield* fileSystem.remove(writes[index], {
							force: true,
						});
				for (let index = 0; index < deletes.length; index += 1)
					yield* filesystemWrite.replaceFileFx({
						lock,
						target: deletes[index],
						bytes: Uint8Array.from(
							yield* fileSystem.readFile(backups[writes.length + index]),
						),
					});
			}

			for (const entry of allowed)
				if (entry !== "record.json") yield* removeFileFx(active, path.join(active, entry));
			yield* removeFileFx(active, recordFile);
			if ((yield* fileSystem.readDirectory(active)).length > 0)
				return yield* failRecoveryFx(active, "Recovery directory is not empty.");
			yield* removeEmptyDirectoryFx(active);
		}).pipe(
			Effect.catch((cause) =>
				cause instanceof FilesystemWriteError && cause.operation === "recover"
					? Effect.fail(cause)
					: failRecoveryFx(
							active,
							`Editor project recovery failed; preserved ${active}.`,
							cause,
						),
			),
		);
	},
);
