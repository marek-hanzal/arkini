import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import {
	assertCanonicalEditorJsonExportArtifactFx,
	isOwnedEditorJsonExportTargetFx,
	readEditorJsonExportRecoveryPaths,
	readEditorJsonExportRecoveryRecordFx,
} from "./EditorJsonExportRecoveryRecord";
import { readEditorJsonExportFx } from "./readEditorJsonExportFx";

/** Moves the verified staged project to its stable, terminal recovery path. */
export const preserveEditorJsonExportRecoveryFx = Effect.fn("preserveEditorJsonExportRecoveryFx")(
	function* (recoveryDirectory: string) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const record = yield* readEditorJsonExportRecoveryRecordFx(recoveryDirectory);
		const paths = readEditorJsonExportRecoveryPaths(path, record);
		if (!(yield* fileSystem.exists(paths.preserved))) {
			if (yield* assertCanonicalEditorJsonExportArtifactFx(paths.pending))
				yield* fileSystem.rename(paths.pending, paths.preserved);
			else if (yield* isOwnedEditorJsonExportTargetFx(paths.marker, record.transaction)) {
				yield* assertCanonicalEditorJsonExportArtifactFx(record.target);
				yield* fileSystem.rename(record.target, paths.preserved);
			} else
				return yield* Effect.fail(
					new Error("Editor export recovery has no verified staged project to preserve."),
				);
			yield* syncFilesystemPathFx(fileSystem, paths.parent);
		}
		yield* assertCanonicalEditorJsonExportArtifactFx(paths.preserved);
		yield* readEditorJsonExportFx(paths.preserved);
		return paths.preserved;
	},
);
