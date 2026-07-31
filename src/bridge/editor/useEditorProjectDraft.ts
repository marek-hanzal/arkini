import { useAtomValue } from "@effect/atom-react";

import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";

/** Reads staged project changes without folding them into the canonical project snapshot. */
export const useEditorProjectDraft = (projectId: string) =>
	useAtomValue(EditorProjectDraftAtom(projectId));
