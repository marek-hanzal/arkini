import { createFileRoute } from "@tanstack/react-router";

import { EditorFlowPage } from "~/page/editor/EditorFlowPage";

export const Route = createFileRoute("/editor/$projectId/flow")({
	component: EditorFlowPage,
});
