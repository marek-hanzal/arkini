import { Effect } from "effect";

import {
	type EditorItemSectionId,
	EditorItemSectionIds,
} from "~/ui/item/editor/EditorItemSections";

export type { EditorItemSectionId };

/** Parses one explicit item section route segment. */
export const parseEditorItemSectionIdFx = Effect.fn("parseEditorItemSectionIdFx")(
	(candidate: string): Effect.Effect<EditorItemSectionId, Error> => {
		const section = EditorItemSectionIds.find((id) => id === candidate);
		return section === undefined
			? Effect.fail(new Error(`Unknown editor item section ${candidate}.`))
			: Effect.succeed(section);
	},
);
