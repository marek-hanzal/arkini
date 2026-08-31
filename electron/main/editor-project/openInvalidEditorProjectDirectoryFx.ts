import { shell } from "electron";
import { Effect } from "effect";

import type { OwnedEditorProjectRepository } from "./EditorProjectServiceOwnership";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Opens only an exact project root currently blocked by complete repository validation. */
export const openInvalidEditorProjectDirectoryFx = Effect.fn("openInvalidEditorProjectDirectoryFx")(
	function* ({
		repository,
		root,
	}: {
		readonly repository: OwnedEditorProjectRepository;
		readonly root: string;
	}) {
		const candidate = (yield* repository.listProjectsFx).find(
			(project) => project.type === "invalid" && project.root === root,
		);
		if (candidate === undefined || candidate.type !== "invalid")
			return yield* Effect.fail(
				new ProjectRepositoryError({
					operation: "open-project-directory",
					message: "The Editor project folder is not a currently blocked project.",
				}),
			);
		yield* Effect.tryPromise({
			try: async () => {
				const error = await shell.openPath(candidate.root);
				if (error !== "") throw new Error(error);
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "open-project-directory",
					message: "The invalid Editor project folder could not be opened.",
					cause,
				}),
		});
	},
);
