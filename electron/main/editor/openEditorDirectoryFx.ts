import { shell } from "electron";
import { FileSystem } from "effect";
import { Effect } from "effect";
import { join, relative } from "node:path";

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
	let directory = projectId === undefined ? root : join(root, projectId);
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
	} else {
		const info = yield* fileSystem.stat(directory);
		if (info.type !== "Directory") {
			return yield* Effect.fail(
				new ElectronMainError({
					operation: "Open Arkini editor directory",
					cause: new Error(`Editor project ${projectId} is not a directory.`),
				}),
			);
		}
		const canonicalRoot = yield* fileSystem.realPath(root);
		const canonicalDirectory = yield* fileSystem.realPath(directory);
		if (relative(join(canonicalRoot, projectId), canonicalDirectory) !== "") {
			return yield* Effect.fail(
				new ElectronMainError({
					operation: "Open Arkini editor directory",
					cause: new Error(
						`Editor project ${projectId} resolves outside its canonical directory.`,
					),
				}),
			);
		}
		directory = canonicalDirectory;
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
