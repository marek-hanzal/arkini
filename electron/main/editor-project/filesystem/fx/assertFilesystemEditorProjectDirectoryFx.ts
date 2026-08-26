import { FileSystem, Path } from "effect";
import { Effect } from "effect";

/** Rejects a project-owned directory whose canonical path escapes through a symbolic link. */
export const assertFilesystemEditorProjectDirectoryFx = Effect.fn(
	"assertFilesystemEditorProjectDirectoryFx",
)(function* ({ root, directory }: { readonly root: string; readonly directory: string }) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const canonicalRoot = yield* fileSystem.realPath(root);
	const expected = path.join(canonicalRoot, path.relative(root, directory));
	if ((yield* fileSystem.realPath(directory)) !== expected)
		return yield* Effect.fail(
			new Error(`Editor project directory ${directory} must not be a symbolic link.`),
		);
});
