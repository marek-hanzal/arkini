import { Effect } from "effect";

import type { FilesystemWrite } from "~/engine/filesystem/FilesystemWrite";

/** Holds the shared crash-recovering lock for one external Editor project. */
export const withFilesystemEditorProjectLockFx = <Value, Failure, Requirements>(
	filesystemWrite: FilesystemWrite,
	root: string,
	effect: Effect.Effect<Value, Failure, Requirements>,
) => filesystemWrite.withLockFx(`${root}/editor.lock`, effect);
