import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";

/** Returns one complete canonical item with the project revision required for safe replacement. */
export const readEditorMcpItemConfigTextFx = Effect.fn("readEditorMcpItemConfigTextFx")(
	(project: EditorProject, itemId: string) =>
		Effect.gen(function* () {
			const item = project.config.items[itemId];
			if (item === undefined)
				return yield* Effect.fail(
					new Error(`Item ${itemId} does not exist in the open project.`),
				);
			return JSON.stringify(
				{
					revision: project.revision,
					item,
				},
				null,
				2,
			);
		}),
);
