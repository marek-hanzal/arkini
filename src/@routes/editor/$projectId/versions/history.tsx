import { createFileRoute } from "@tanstack/react-router";

import { EditorVersionHistoryPage } from "~/page/editor/EditorVersionHistoryPage";

export const Route = createFileRoute("/editor/$projectId/versions/history")({
	component: EditorVersionHistoryPage,
});
