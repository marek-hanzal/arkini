import { basename, dirname, join } from "node:path";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem } from "effect";

import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

export const readCanonicalSerapackPathFx = Effect.fn("readCanonicalSerapackPathFx")(function* (
	fileSystem: FileSystem.FileSystem,
	serapackPath: string,
) {
	const root = yield* fileSystem.realPath(dirname(serapackPath));
	return join(root, basename(serapackPath));
});

/** Excludes a concurrent writer while reading or removing one Serapack file. */
export const withSerapackFileLockFx = <Value, Error, Requirements>(
	props: {
		readonly serapackPath: string;
		readonly fileSystem: FileSystem.FileSystem;
	},
	effectFx: (serapackPath: string) => Effect.Effect<Value, Error, Requirements>,
) =>
	Effect.gen(function* () {
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provide(NodePath.layer),
			Effect.provideService(FileSystem.FileSystem, props.fileSystem),
		);
		const serapackPath = yield* readCanonicalSerapackPathFx(
			props.fileSystem,
			props.serapackPath,
		);
		return yield* filesystemWrite.withLockFx(
			join(dirname(serapackPath), `.${basename(serapackPath)}.lock`),
			effectFx(serapackPath),
		);
	});
