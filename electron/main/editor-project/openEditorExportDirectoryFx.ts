import { shell } from "electron";
import { Effect } from "effect";

import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";

/** Opens one successful Editor source-export root in the operating-system file browser. */
export const openEditorExportDirectoryFx = Effect.fn("openEditorExportDirectoryFx")(
	(root: string) =>
		Effect.tryPromise({
			try: async () => {
				const error = await shell.openPath(root);
				if (error !== "") throw new Error(error);
			},
			catch: (cause) =>
				new EditorProjectRepositoryError({
					operation: "open-export-directory",
					message: "The Editor project export folder could not be opened.",
					cause,
				}),
		}),
);
