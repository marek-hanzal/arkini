import { Context, Effect, FileSystem, Path } from "effect";
import { lock as acquireLock } from "proper-lockfile";

import { FilesystemWriteError } from "../error/FilesystemWriteError";
import type { FilesystemWrite } from "../service/FilesystemWrite";
import { isFilesystemPathSafeFx } from "./isFilesystemPathSafeFx";
import { prepareFilesystemWriteTargetFx } from "./prepareFilesystemWriteTargetFx";

interface FilesystemWritePaths {
	readonly lock: string;
	readonly parent: string;
}

interface FilesystemLock {
	readonly releaseFn: () => Promise<void>;
}

const HeldFilesystemWriteLocks = Context.Reference<ReadonlyMap<string, number>>(
	"Arkini/FilesystemWrite/HeldLocks",
	{
		defaultValue: () => new Map(),
	},
);

const lockErrorFn = (lock: string, message: string, cause: unknown) =>
	new FilesystemWriteError({
		operation: "lock",
		message: `Filesystem write lock ${lock} ${message}.`,
		cause,
	});

const isAlreadyReleasedFn = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ERELEASED";

const acquireFx = Effect.fn("acquireFilesystemWriteLockFx")((lock: string) =>
	Effect.tryPromise({
		try: () =>
			acquireLock(lock, {
				lockfilePath: lock,
				onCompromised: (cause) => {
					throw lockErrorFn(lock, "was compromised", cause);
				},
				realpath: false,
				retries: {
					factor: 1,
					maxTimeout: 500,
					minTimeout: 500,
					retries: 10,
				},
				stale: 3_000,
				update: 1_000,
			}).then((releaseFn) => ({
				releaseFn,
			})),
		catch: (cause) => lockErrorFn(lock, "could not be acquired", cause),
	}),
);

const releaseFx = (lock: string, owner: FilesystemLock) =>
	Effect.tryPromise({
		try: () =>
			owner.releaseFn().catch((cause: unknown) => {
				if (!isAlreadyReleasedFn(cause)) throw cause;
			}),
		catch: (cause) => lockErrorFn(lock, "could not be released", cause),
	});

const withFilesystemLockFx = <Value, Failure, Requirements>(
	lock: string,
	effect: Effect.Effect<Value, Failure, Requirements>,
) =>
	Effect.acquireUseRelease(
		acquireFx(lock),
		() => effect,
		(owner) => releaseFx(lock, owner),
	);

/** Canonicalizes one explicit lock below its real parent directory. */
const readFilesystemWritePathsFx = Effect.fn("readFilesystemWritePathsFx")(function* (
	requestedLock: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const requestedParent = path.dirname(path.resolve(requestedLock));
	yield* fileSystem.makeDirectory(requestedParent, {
		recursive: true,
	});
	const parent = yield* fileSystem.realPath(requestedParent);
	const lock = path.join(parent, path.basename(requestedLock));
	return {
		lock,
		parent,
	} satisfies FilesystemWritePaths;
});

/** Removes one exact owned regular file without recursive deletion. */
const removeFileFx = Effect.fn("removeFileFx")(function* ({
	paths,
	props,
}: {
	readonly paths: FilesystemWritePaths;
	readonly props: Parameters<FilesystemWrite["removeFileFx"]>[0];
}) {
	const path = yield* Path.Path;
	const prepared = yield* prepareFilesystemWriteTargetFx({
		operation: "remove-file",
		root: paths.parent,
		requestedRoot: path.dirname(path.resolve(props.lock)),
		target: props.target,
	});
	if (prepared.target === paths.lock)
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation: "remove-file",
				message: `Filesystem write target ${prepared.target} is the active lock.`,
			}),
		);
	yield* (yield* FileSystem.FileSystem).remove(prepared.target, {
		force: true,
	});
});

/** Syncs and atomically renames one exact sibling staging file over its owned target. */
const replaceFileFx = Effect.fn("replaceFileFx")(function* ({
	paths,
	props,
}: {
	readonly paths: FilesystemWritePaths;
	readonly props: Parameters<FilesystemWrite["replaceFileFx"]>[0];
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const requestedRoot = path.dirname(path.resolve(props.lock));
	const prepared = yield* prepareFilesystemWriteTargetFx({
		operation: "replace-file",
		root: paths.parent,
		requestedRoot,
		target: props.target,
	});
	if (prepared.target === paths.lock)
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation: "replace-file",
				message: `Filesystem write target ${prepared.target} is the active lock.`,
			}),
		);
	const pending = `${prepared.target}.arkini-replace`;
	if (!(yield* isFilesystemPathSafeFx(fileSystem, paths.parent, pending)))
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation: "replace-file",
				message: `Filesystem write staging file ${pending} must be canonical and must not be a symbolic link.`,
			}),
		);
	if (yield* fileSystem.exists(pending)) {
		const info = yield* fileSystem.stat(pending);
		if (info.type !== "File")
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation: "replace-file",
					message: `Filesystem write staging file ${pending} must be canonical and must not be a symbolic link.`,
				}),
			);
		yield* fileSystem.remove(pending, {
			force: true,
		});
	}
	let ownsPending = false;
	return yield* Effect.uninterruptibleMask((restoreFx) =>
		Effect.scoped(
			Effect.gen(function* () {
				const file = yield* fileSystem.open(pending, {
					flag: "wx",
				});
				ownsPending = true;
				yield* restoreFx(file.writeAll(props.bytes));
				yield* restoreFx(file.sync);
			}),
		).pipe(
			Effect.andThen(
				Effect.uninterruptible(
					fileSystem.rename(pending, prepared.target).pipe(
						Effect.tap(() =>
							Effect.sync(() => {
								ownsPending = false;
							}),
						),
					),
				),
			),
			Effect.ensuring(
				Effect.suspend(() =>
					ownsPending
						? fileSystem
								.remove(pending, {
									force: true,
								})
								.pipe(Effect.ignore)
						: Effect.void,
				),
			),
		),
	).pipe(
		Effect.mapError((cause) =>
			cause instanceof FilesystemWriteError
				? cause
				: new FilesystemWriteError({
						operation: "replace-file",
						message: "The atomic filesystem file replacement failed.",
						cause,
					}),
		),
	);
});

/** Creates the Node-only canonical lock and exact single-file write capability. */
export const createFilesystemWriteFx = Effect.fn("createFilesystemWriteFx")(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const provideFx = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);
	const mapInternalFx = (operation: "lock" | "remove-file" | "replace-file") =>
		Effect.mapError((cause) =>
			cause instanceof FilesystemWriteError
				? cause
				: new FilesystemWriteError({
						operation,
						message: `Filesystem write operation ${operation} failed.`,
						cause,
					}),
		);
	const underLockFx = <Value, Failure, Requirements>(
		paths: FilesystemWritePaths,
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		Effect.gen(function* () {
			const held = yield* HeldFilesystemWriteLocks;
			const fiberId = yield* Effect.fiberId;
			if (held.get(paths.lock) === fiberId) return yield* effect;
			return yield* withFilesystemLockFx(
				paths.lock,
				effect.pipe(
					Effect.provideService(
						HeldFilesystemWriteLocks,
						new Map<string, number>(held).set(paths.lock, fiberId),
					),
				),
			);
		});
	const withLockFx: FilesystemWrite["withLockFx"] = (lock, effect) =>
		provideFx(
			readFilesystemWritePathsFx(lock).pipe(
				mapInternalFx("lock"),
				Effect.flatMap((paths) => underLockFx(paths, effect)),
			),
		);
	const replaceLockedFileFx: FilesystemWrite["replaceFileFx"] = (props) =>
		provideFx(
			readFilesystemWritePathsFx(props.lock).pipe(
				mapInternalFx("replace-file"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						replaceFileFx({
							paths,
							props,
						}).pipe(mapInternalFx("replace-file")),
					),
				),
			),
		);
	const replaceIndependentLockedFilesFx: FilesystemWrite["replaceIndependentFilesFx"] = (props) =>
		provideFx(
			readFilesystemWritePathsFx(props.lock).pipe(
				mapInternalFx("replace-file"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						Effect.forEach(
							props.files,
							(file) =>
								replaceFileFx({
									paths,
									props: {
										lock: props.lock,
										...file,
									},
								}),
							{
								concurrency: props.concurrency,
								discard: true,
							},
						).pipe(mapInternalFx("replace-file")),
					),
				),
			),
		);
	const removeLockedFileFx: FilesystemWrite["removeFileFx"] = (props) =>
		provideFx(
			readFilesystemWritePathsFx(props.lock).pipe(
				mapInternalFx("remove-file"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						removeFileFx({
							paths,
							props,
						}).pipe(mapInternalFx("remove-file")),
					),
				),
			),
		);
	return {
		withLockFx,
		removeFileFx: removeLockedFileFx,
		replaceFileFx: replaceLockedFileFx,
		replaceIndependentFilesFx: replaceIndependentLockedFilesFx,
	} satisfies FilesystemWrite;
});
