import { createFileRoute } from "@tanstack/react-router";

import { EditorNotesPage } from "~/page/editor/EditorNotesPage";

export const Route = createFileRoute("/editor/$projectId/notes")({
	component: EditorNotesPage,
});
