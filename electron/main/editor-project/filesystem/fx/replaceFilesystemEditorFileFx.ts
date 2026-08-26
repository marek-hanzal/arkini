import { FileSystem, Path } from "effect";
import { Effect } from "effect";

export namespace replaceFilesystemEditorFileFx {
	export interface Props {
		readonly target: string;
		readonly bytes: Uint8Array;
	}
}

/** Replaces one file through its fixed sibling so an interrupted write leaves the old target. */
export const replaceFilesystemEditorFileFx = Effect.fn("replaceFilesystemEditorFileFx")(function* ({
	target,
	bytes,
}: replaceFilesystemEditorFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const pending = `${target}.tmp`;
	const parent = path.dirname(target);
	yield* fileSystem.makeDirectory(parent, {
		recursive: true,
	});
	const canonicalParent = yield* fileSystem.realPath(parent);
	const canonicalParentBase = yield* fileSystem.realPath(path.dirname(parent));
	if (canonicalParent !== path.join(canonicalParentBase, path.basename(parent)))
		return yield* Effect.fail(
			new Error(`Editor file directory ${parent} must not be a symbolic link.`),
		);
	// The fixed pending path is disposable; an interrupted predecessor never owns it.
	yield* fileSystem.remove(pending, {
		force: true,
	});
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(pending, {
				flag: "w",
			});
			yield* file.writeAll(bytes);
			yield* file.sync;
		}),
	);
	yield* fileSystem.rename(pending, target);
});
