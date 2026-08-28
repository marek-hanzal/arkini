import { basename, dirname, join } from "node:path";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem } from "effect";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { readCanonicalArkpackPathFx } from "./withArkpackFileLockFx";

/** Atomically publishes one self-contained Arkpack. */
export const writeArkpackFileFx = Effect.fn("writeArkpackFileFx")(function* ({
	arkpackPath,
	bytes,
	fileSystem,
}: {
	readonly arkpackPath: string;
	readonly bytes: Uint8Array;
	readonly fileSystem: FileSystem.FileSystem;
}) {
	yield* fileSystem.makeDirectory(dirname(arkpackPath), {
		recursive: true,
	});
	const target = yield* readCanonicalArkpackPathFx(fileSystem, arkpackPath);
	const filesystemWrite = yield* createFilesystemWriteFx().pipe(
		Effect.provide(NodePath.layer),
		Effect.provideService(FileSystem.FileSystem, fileSystem),
	);
	yield* filesystemWrite.writeFileFx({
		lock: join(dirname(target), `.${basename(target)}.lock`),
		target,
		bytes,
	});
});
