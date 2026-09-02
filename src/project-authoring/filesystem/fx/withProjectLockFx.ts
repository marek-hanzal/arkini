import { Effect } from "effect";

import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { recoverProjectFileTransactionFx } from "./recoverProjectFileTransactionFx";

/** Recovers and holds the shared current-tree lock for one portable Editor project. */
export const withProjectLockFx = Effect.fn("withProjectLockFx")(
	<Value, Failure, Requirements>(
		filesystemWrite: FilesystemWrite,
		root: string,
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		filesystemWrite.withLockFx(
			`${root}/editor.lock`,
			recoverProjectFileTransactionFx(filesystemWrite, root).pipe(Effect.andThen(effect)),
		),
);
