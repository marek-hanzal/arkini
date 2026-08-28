import { basename, dirname, join } from "node:path";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem } from "effect";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";

export const readCanonicalArkpackPathFx = Effect.fn("readCanonicalArkpackPathFx")(function* (
	fileSystem: FileSystem.FileSystem,
	arkpackPath: string,
) {
	const root = yield* fileSystem.realPath(dirname(arkpackPath));
	return join(root, basename(arkpackPath));
});

/** Excludes a concurrent writer while reading or removing one Arkpack file. */
export const withArkpackFileLockFx = <Value, Error, Requirements>(
	props: {
		readonly arkpackPath: string;
		readonly fileSystem: FileSystem.FileSystem;
	},
	effect: (arkpackPath: string) => Effect.Effect<Value, Error, Requirements>,
) =>
	Effect.gen(function* () {
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provide(NodePath.layer),
			Effect.provideService(FileSystem.FileSystem, props.fileSystem),
		);
		const arkpackPath = yield* readCanonicalArkpackPathFx(props.fileSystem, props.arkpackPath);
		return yield* filesystemWrite.withLockFx(
			join(dirname(arkpackPath), `.${basename(arkpackPath)}.lock`),
			effect(arkpackPath),
		);
	});
