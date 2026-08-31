import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import type { ProjectFiles } from "~electron/main/editor-project/filesystem/fx/ProjectFiles";
import { readProjectFilesFx } from "~electron/main/editor-project/filesystem/fx/readProjectFilesFx";
import { writeProjectFilesFx } from "~electron/main/editor-project/filesystem/fx/writeProjectFilesFx";

export const createProjectFilesHarness = async () => {
	const parent = await mkdtemp(join(tmpdir(), "arkini-editor-files-"));
	const root = join(parent, "project");

	return {
		root,
		read: () =>
			Effect.runPromise(readProjectFilesFx(root).pipe(Effect.provide(NodeServices.layer))),
		write: (next: ProjectFiles, previous?: ProjectFiles) =>
			Effect.runPromise(
				writeProjectFilesFx({
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
