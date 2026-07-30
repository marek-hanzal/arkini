import { FileSystem } from "effect";
import { Effect } from "effect";

import type { EditorProjectManifest } from "../../contract/editor/EditorProjectManifest";
import { ElectronMainError } from "../ElectronMainError";
import { readEditorProjectManifestFx } from "./readEditorProjectManifestFx";

export namespace listEditorProjectsFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
	}
}

/** Lists only projects with a valid canonical editor.json manifest, newest first. */
export const listEditorProjectsFx = Effect.fn("listEditorProjectsFx")(
	({ root, fileSystem }: listEditorProjectsFx.Props) =>
		Effect.gen(function* () {
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			const entries = yield* fileSystem.readDirectory(root);
			const candidates = yield* Effect.forEach(entries, (projectId) =>
				readEditorProjectManifestFx({
					root,
					fileSystem,
					projectId,
				}).pipe(Effect.catch(() => Effect.succeed(null))),
			);
			return candidates
				.filter((manifest): manifest is EditorProjectManifest => manifest !== null)
				.sort(
					(left, right) =>
						right.updatedAtMs - left.updatedAtMs ||
						left.projectId.localeCompare(right.projectId),
				) satisfies ReadonlyArray<EditorProjectManifest>;
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "List Arkini editor projects",
						cause,
					}),
			),
		),
);
