import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import type { FilesystemEditorProjectFiles } from "../../../../../electron/main/editor-project/filesystem/fx/FilesystemEditorProjectFiles";
import { readFilesystemEditorProjectFilesFx } from "../../../../../electron/main/editor-project/filesystem/fx/readFilesystemEditorProjectFilesFx";
import { writeFilesystemEditorProjectFilesFx } from "../../../../../electron/main/editor-project/filesystem/fx/writeFilesystemEditorProjectFilesFx";

export const createProjectFilesHarness = async () => {
	const parent = await mkdtemp(join(tmpdir(), "arkini-editor-files-"));
	const root = join(parent, "project");

	return {
		root,
		read: () =>
			Effect.runPromise(
				readFilesystemEditorProjectFilesFx(root).pipe(Effect.provide(NodeServices.layer)),
			),
		write: (next: FilesystemEditorProjectFiles, previous?: FilesystemEditorProjectFiles) =>
			Effect.runPromise(
				writeFilesystemEditorProjectFilesFx({
					root,
					previous,
					next,
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		close: () =>
			rm(parent, {
				force: true,
				recursive: true,
			}),
	};
};
