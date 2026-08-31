import { shell } from "electron";
import { Effect } from "effect";

import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Opens one successful Editor source-export root in the operating-system file browser. */
export const openEditorExportDirectoryFx = Effect.fn("openEditorExportDirectoryFx")(
	(root: string) =>
		Effect.tryPromise({
			try: async () => {
				const error = await shell.openPath(root);
				if (error !== "") throw new Error(error);
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "open-export-directory",
					message: "The Editor project export folder could not be opened.",
					cause,
				}),
		}),
);
