import { createFileRoute } from "@tanstack/react-router";

import { EditorItemsPage } from "~/page/editor/EditorItemsPage";

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	component: EditorItemsPage,
});
