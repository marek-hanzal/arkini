import { Effect } from "effect";

import {
	type EditorProjectSectionId,
	EditorProjectSectionIds,
} from "~/ui/project/editor/EditorProjectSections";

/** Parses one explicit Project-section route segment. */
export const parseEditorProjectSectionIdFx = Effect.fn("parseEditorProjectSectionIdFx")(
	(candidate: string): Effect.Effect<EditorProjectSectionId, Error> => {
		const section = EditorProjectSectionIds.find((id) => id === candidate);
		return section === undefined
			? Effect.fail(new Error(`Unknown editor project section ${candidate}.`))
			: Effect.succeed(section);
	},
);
