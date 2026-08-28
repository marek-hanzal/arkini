import { FileSystem } from "effect";
import { Effect } from "effect";
import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";

/** Rejects a project-owned directory whose canonical path escapes through a symbolic link. */
export const assertProjectDirectoryFx = Effect.fn(
	"assertProjectDirectoryFx",
)(function* ({ root, directory }: { readonly root: string; readonly directory: string }) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (!(yield* isFilesystemPathSafeFx(fileSystem, root, directory)))
		return yield* Effect.fail(
			new Error(`Editor project directory ${directory} must not be a symbolic link.`),
		);
});
