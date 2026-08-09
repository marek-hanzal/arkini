import { Effect } from "effect";

import {
	type EditorProjectSectionId,
	EditorProjectSectionIds,
} from "~/ui/project/editor/EditorProjectSections";

/** Parses one explicit Project section route segment. */
export const parseEditorProjectSectionIdFx = Effect.fn("parseEditorProjectSectionIdFx")(
	(candidate: string) =>
		Effect.sync((): EditorProjectSectionId => {
			const section = EditorProjectSectionIds.find((id) => id === candidate);
			if (section === undefined)
				throw new Error(`Unknown editor project section ${candidate}.`);
			return section;
		}),
);
