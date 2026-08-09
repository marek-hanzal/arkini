import { Effect } from "effect";

import {
	type EditorItemSectionId,
	EditorItemSectionIds,
} from "~/ui/item/editor/EditorItemSections";

/** Parses one explicit item section route segment. */
export const parseEditorItemSectionIdFx = Effect.fn("parseEditorItemSectionIdFx")(
	(candidate: string) =>
		Effect.sync((): EditorItemSectionId => {
			const section = EditorItemSectionIds.find((id) => id === candidate);
			if (section === undefined) throw new Error(`Unknown editor item section ${candidate}.`);
			return section;
		}),
);
