import { basename, dirname, join } from "node:path";
import { FileSystem } from "effect";
import { Effect, Exit } from "effect";

import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import { withFilesystemLockFx } from "../filesystem/withFilesystemLockFx";

export const readArkpackArtifactPairPaths = (arkpackPath: string) => {
	const root = dirname(arkpackPath);
	const transaction = join(root, `.${basename(arkpackPath)}.transaction`);
	return {
		cleanup: `${transaction}.cleanup`,
		lock: join(root, `.${basename(arkpackPath)}.lock`),
		pendingArkpack: join(transaction, "pending.arkpack"),
		pendingSignature: join(transaction, "pending.arksig"),
		previousArkpack: join(transaction, "previous.arkpack"),
		previousSignature: join(transaction, "previous.arksig"),
		root,
		transaction,
	};
};

const assertCanonicalEntryFx = Effect.fn("assertCanonicalArkpackEntryFx")(function* ({
	fileSystem,
	target,
	type,
}: {
	readonly fileSystem: FileSystem.FileSystem;
	readonly target: string;
	readonly type: "Directory" | "File";
}) {
	if (!(yield* fileSystem.exists(target))) return false;
	const info = yield* fileSystem.stat(target);
	if (info.type !== type || (yield* fileSystem.realPath(target)) !== target)
		return yield* Effect.fail(
			new Error(`Arkpack publication path ${target} is not canonical.`),
		);
	return true;
});

export const readCanonicalArkpackPathFx = Effect.fn("readCanonicalArkpackPathFx")(function* (
	fileSystem: FileSystem.FileSystem,
	arkpackPath: string,
) {
	const root = yield* fileSystem.realPath(dirname(arkpackPath));
	return join(root, basename(arkpackPath));
});

export const finalizeArkpackArtifactPairTransactionFx = Effect.fn(
	"finalizeArkpackArtifactPairTransactionFx",
)(function* ({
	arkpackPath,
	fileSystem,
}: {
	readonly arkpackPath: string;
	readonly fileSystem: FileSystem.FileSystem;
}) {
	const paths = readArkpackArtifactPairPaths(arkpackPath);
	if (
		yield* assertCanonicalEntryFx({
			fileSystem,
			target: paths.cleanup,
			type: "Directory",
		})
	) {
		yield* fileSystem.remove(paths.cleanup, {
			recursive: true,
		});
		yield* syncFilesystemPathFx(fileSystem, paths.root);
	}
	if (!(yield* fileSystem.exists(paths.transaction))) return;
	yield* fileSystem.rename(paths.transaction, paths.cleanup);
	yield* syncFilesystemPathFx(fileSystem, paths.root);
	yield* fileSystem.remove(paths.cleanup, {
		recursive: true,
	});
	yield* syncFilesystemPathFx(fileSystem, paths.root);
});

/** Resolves a transaction left by an interrupted pair publication before the pair is observed. */
export const recoverArkpackArtifactPairUnlockedFx = Effect.fn(
	"recoverArkpackArtifactPairUnlockedFx",
)(function* ({
	arkpackPath,
	fileSystem,
}: {
	readonly arkpackPath: string;
	readonly fileSystem: FileSystem.FileSystem;
}) {
	const paths = readArkpackArtifactPairPaths(arkpackPath);
	const signaturePath = yield* readArkpackSignaturePathFx(arkpackPath);
	for (const target of [
		arkpackPath,
		signaturePath,
	])
		yield* assertCanonicalEntryFx({
			fileSystem,
			target,
			type: "File",
		});
	if (
		yield* assertCanonicalEntryFx({
			fileSystem,
			target: paths.cleanup,
			type: "Directory",
		})
	) {
		yield* fileSystem.remove(paths.cleanup, {
			recursive: true,
		});
		yield* syncFilesystemPathFx(fileSystem, paths.root);
	}
	if (!(yield* fileSystem.exists(paths.transaction))) return;
	yield* assertCanonicalEntryFx({
		fileSystem,
		target: paths.transaction,
		type: "Directory",
	});
	for (const entry of yield* fileSystem.readDirectory(paths.transaction))
		yield* assertCanonicalEntryFx({
			fileSystem,
			target: join(paths.transaction, entry),
			type: "File",
		});
	if (
		(yield* fileSystem.exists(join(paths.transaction, "committed"))) ||
		!(yield* fileSystem.exists(join(paths.transaction, "ready")))
	) {
		yield* finalizeArkpackArtifactPairTransactionFx({
			arkpackPath,
			fileSystem,
		});
		return;
	}

	const pairs = [
		[
			arkpackPath,
			paths.previousArkpack,
			join(paths.transaction, "had-arkpack"),
			join(paths.transaction, "restore.arkpack"),
		],
		[
			signaturePath,
			paths.previousSignature,
			join(paths.transaction, "had-signature"),
			join(paths.transaction, "restore.arksig"),
		],
	] as const;
	const restorations = yield* Effect.all(
		pairs.map(([canonical, previous, hadMarker, restore]) =>
			Effect.exit(
				Effect.gen(function* () {
					if (yield* fileSystem.exists(hadMarker)) {
						if (!(yield* fileSystem.exists(previous)))
							return yield* Effect.fail(
								new Error(`Arkpack recovery backup ${previous} is missing.`),
							);
						yield* fileSystem.copy(previous, restore, {
							overwrite: true,
						});
						yield* syncFilesystemPathFx(fileSystem, restore);
						yield* fileSystem.rename(restore, canonical);
					} else {
						yield* fileSystem.remove(canonical, {
							force: true,
						});
					}
				}),
			),
		),
		{
			concurrency: "unbounded",
		},
	);
	const failedRestoration = restorations.find(Exit.isFailure);
	if (failedRestoration !== undefined) return yield* Effect.failCause(failedRestoration.cause);
	yield* syncFilesystemPathFx(fileSystem, paths.root);
	yield* finalizeArkpackArtifactPairTransactionFx({
		arkpackPath,
		fileSystem,
	});
});

export const recoverArkpackArtifactPairFx = Effect.fn("recoverArkpackArtifactPairFx")(
	(props: { readonly arkpackPath: string; readonly fileSystem: FileSystem.FileSystem }) =>
		Effect.gen(function* () {
			const arkpackPath = yield* readCanonicalArkpackPathFx(
				props.fileSystem,
				props.arkpackPath,
			);
			return yield* withFilesystemLockFx(
				readArkpackArtifactPairPaths(arkpackPath).lock,
				recoverArkpackArtifactPairUnlockedFx({
					...props,
					arkpackPath,
				}),
			);
		}),
);

/** Runs one read against a recovered pair while its writer is excluded. */
export const withRecoveredArkpackArtifactPairFx = <Value, Error, Requirements>(
	props: {
		readonly arkpackPath: string;
		readonly fileSystem: FileSystem.FileSystem;
	},
	effect: (arkpackPath: string) => Effect.Effect<Value, Error, Requirements>,
) =>
	Effect.gen(function* () {
		const arkpackPath = yield* readCanonicalArkpackPathFx(props.fileSystem, props.arkpackPath);
		return yield* withFilesystemLockFx(
			readArkpackArtifactPairPaths(arkpackPath).lock,
			recoverArkpackArtifactPairUnlockedFx({
				...props,
				arkpackPath,
			}).pipe(Effect.andThen(effect(arkpackPath))),
		);
	});
