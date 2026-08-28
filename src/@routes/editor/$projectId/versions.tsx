import { createFileRoute } from "@tanstack/react-router";

import { EditorVersionsPage } from "~/page/editor/EditorVersionsPage";

export const Route = createFileRoute("/editor/$projectId/versions")({
	component: EditorVersionsPage,
});
