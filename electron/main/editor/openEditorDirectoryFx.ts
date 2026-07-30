import { shell } from "electron";
import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";

import { ElectronMainError } from "../ElectronMainError";
import { assertEditorProjectIdFx } from "./assertEditorProjectIdFx";

export namespace openEditorDirectoryFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly projectId?: string;
	}
}

/** Opens the editor root or one validated project in the operating-system file manager. */
export const openEditorDirectoryFx = Effect.fn("openEditorDirectoryFx")(function* ({
	root,
	fileSystem,
	projectId: candidate,
}: openEditorDirectoryFx.Props) {
	const projectId =
		candidate === undefined ? undefined : yield* assertEditorProjectIdFx(candidate);
	const directory = projectId === undefined ? root : join(root, projectId);
	if (projectId === undefined) {
		yield* fileSystem.makeDirectory(directory, {
			recursive: true,
		});
	} else if (!(yield* fileSystem.exists(directory))) {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Open Arkini editor directory",
				cause: new Error(`Editor project ${projectId} does not exist.`),
			}),
		);
	}
	const error = yield* Effect.tryPromise({
		try: () => shell.openPath(directory),
		catch: (cause) =>
			new ElectronMainError({
				operation: "Open Arkini editor directory",
				cause,
			}),
	});
	if (error !== "") {
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Open Arkini editor directory",
				cause: new Error(error),
			}),
		);
	}
});
