import { Effect } from "effect";

import type { EditorProjectSectionId } from "~/ui/project/editor/EditorProjectSections";

/** Maps one canonical Project-schema path to its route-owned section. */
export const readEditorProjectSectionForPathFx = Effect.fn("readEditorProjectSectionForPathFx")(
	(path: ReadonlyArray<PropertyKey>) =>
		Effect.sync((): EditorProjectSectionId => {
			switch (path[0]) {
				case "hero":
				case "avatars":
					return "appearance";
				case "board":
				case "toolbarSize":
				case "inventory":
					return "surfaces";
				default:
					return "general";
			}
		}),
);
