import { Effect, Exit, FileSystem, Path } from "effect";

import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { FilesystemWriteError } from "~/filesystem-write/error/FilesystemWriteError";
import { prepareFilesystemWriteTargetFx } from "~/filesystem-write/fx/prepareFilesystemWriteTargetFx";
import { writeSyncedFileFx } from "~/filesystem-write/fx/writeSyncedFileFx";
import { recoverProjectFileTransactionFx } from "./recoverProjectFileTransactionFx";
import { withProjectLockFx } from "./withProjectLockFx";

const applyProjectFileSetFx = Effect.fn("applyProjectFileSetFx")(function* ({
	filesystemWrite,
	root: requestedRoot,
	plan,
}: {
	readonly filesystemWrite: FilesystemWrite;
	readonly root: string;
	readonly plan: ProjectFileSetPlan;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const resolvedRoot = path.resolve(requestedRoot);
	const root = yield* fileSystem.realPath(resolvedRoot);
	const lock = path.join(root, "editor.lock");
	const active = `${lock}.write`;

	const collisions = new Set<string>();
	const prepareFx = Effect.fn("applyProjectFileSetFx.prepareFx")(function* (target: string) {
		const prepared = yield* prepareFilesystemWriteTargetFx({
			operation: "write-files",
			root,
			requestedRoot: resolvedRoot,
			target,
		});
		if (prepared.target === lock)
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation: "write-files",
					message: "Editor transaction targets its active lock.",
				}),
			);
		for (const candidate of [
			prepared.target,
			`${prepared.target}.arkini-replace`,
		]) {
			const key = candidate.normalize("NFD").toLowerCase();
			if (collisions.has(key))
				return yield* Effect.fail(
					new FilesystemWriteError({
						operation: "write-files",
						message: `Editor transaction target ${candidate} collides.`,
					}),
				);
			collisions.add(key);
		}
		return prepared.target;
	});
	const writes = yield* Effect.forEach(plan.writes, (write) =>
		prepareFx(write.target).pipe(
			Effect.map((target) => ({
				target,
				bytes: write.bytes,
			})),
		),
	);
	const deletes: Array<string> = [];
	for (const candidate of plan.deletes ?? []) {
		const target = yield* prepareFx(candidate);
		if (yield* fileSystem.exists(target)) deletes.push(target);
	}
	const record = {
		writes: yield* Effect.forEach(writes, ({ target }) =>
			fileSystem.exists(target).pipe(
				Effect.map((hadTarget) => ({
					target: path.relative(root, target),
					hadTarget,
				})),
			),
		),
		deletes: deletes.map((target) => path.relative(root, target)),
	};

	const prepareTransactionFx = Effect.gen(function* () {
		yield* fileSystem.makeDirectory(active);
		const pendingRecord = path.join(active, "record.pending");
		yield* writeSyncedFileFx({
			target: pendingRecord,
			bytes: new TextEncoder().encode(JSON.stringify(record)),
		});
		yield* fileSystem.rename(pendingRecord, path.join(active, "record.json"));
		for (let index = 0; index < writes.length; index += 1) {
			if (record.writes[index].hadTarget)
				yield* writeSyncedFileFx({
					target: path.join(active, `old-${index}`),
					bytes: Uint8Array.from(yield* fileSystem.readFile(writes[index].target)),
				});
		}
		for (let index = 0; index < deletes.length; index += 1)
			yield* writeSyncedFileFx({
				target: path.join(active, `old-${writes.length + index}`),
				bytes: Uint8Array.from(yield* fileSystem.readFile(deletes[index])),
			});
	});
	const publishTransactionFx = Effect.gen(function* () {
		yield* writeSyncedFileFx({
			target: path.join(active, "writing"),
			bytes: Uint8Array.of(1),
		});
		for (let index = 0; index < writes.length; index += 1)
			yield* filesystemWrite.replaceFileFx({
				lock,
				target: writes[index].target,
				bytes: writes[index].bytes,
			});
		for (const target of deletes)
			yield* fileSystem.remove(target, {
				force: true,
			});
		yield* writeSyncedFileFx({
			target: path.join(active, "committed"),
			bytes: Uint8Array.of(1),
		});
	});

	return yield* Effect.uninterruptibleMask((restore) =>
		restore(prepareTransactionFx).pipe(
			Effect.andThen(Effect.uninterruptible(publishTransactionFx)),
			Effect.onExit((exit) =>
				Exit.isSuccess(exit)
					? recoverProjectFileTransactionFx(filesystemWrite, root).pipe(Effect.ignore)
					: recoverProjectFileTransactionFx(filesystemWrite, root),
			),
		),
	).pipe(
		Effect.mapError((cause) =>
			cause instanceof FilesystemWriteError
				? cause
				: new FilesystemWriteError({
						operation: "write-files",
						message: "Editor project transaction failed.",
						cause,
					}),
		),
	);
});

interface ProjectFileSetPlan {
	readonly writes: ReadonlyArray<{
		readonly target: string;
		readonly bytes: Uint8Array;
	}>;
	readonly deletes?: ReadonlyArray<string>;
}

/** Recovers, plans, and applies the one portable Editor current-tree transaction. */
export const writeProjectFileSetFx = Effect.fn("writeProjectFileSetFx")(
	<Failure, Requirements>({
		filesystemWrite,
		root,
		planFx,
	}: {
		readonly filesystemWrite: FilesystemWrite;
		readonly root: string;
		readonly planFx: Effect.Effect<ProjectFileSetPlan, Failure, Requirements>;
	}) =>
		withProjectLockFx(
			filesystemWrite,
			root,
			planFx.pipe(
				Effect.flatMap((plan) =>
					applyProjectFileSetFx({
						filesystemWrite,
						root,
						plan,
					}),
				),
			),
		),
);
