import { createFileRoute } from "@tanstack/react-router";

import { EditorBuildPage } from "~/page/editor/EditorBuildPage";

export const Route = createFileRoute("/editor/$projectId/build")({
	component: EditorBuildPage,
});
