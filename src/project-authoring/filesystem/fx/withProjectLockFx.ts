import { Effect } from "effect";

import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";

/** Holds the shared write lock for one portable Editor project. */
export const withProjectLockFx = Effect.fn("withProjectLockFx")(
	<Value, Failure, Requirements>(
		filesystemWrite: FilesystemWrite,
		root: string,
		effect: Effect.Effect<Value, Failure, Requirements>,
	) => filesystemWrite.withLockFx(`${root}/editor.lock`, effect),
);
