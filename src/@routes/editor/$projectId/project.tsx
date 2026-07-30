import { createFileRoute } from "@tanstack/react-router";

import { EditorProjectPage } from "~/page/editor/EditorProjectPage";

export const Route = createFileRoute("/editor/$projectId/project")({
	component: EditorProjectPage,
});
