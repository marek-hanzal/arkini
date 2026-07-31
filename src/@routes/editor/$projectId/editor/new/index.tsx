import { createFileRoute } from "@tanstack/react-router";

import { EditorNewItemPage } from "~/page/editor/EditorNewItemPage";

export const Route = createFileRoute("/editor/$projectId/editor/new/")({
	component: EditorNewItemPage,
});
