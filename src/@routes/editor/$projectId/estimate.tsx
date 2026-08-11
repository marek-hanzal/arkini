import { createFileRoute } from "@tanstack/react-router";

import { EditorEstimatePage } from "~/page/editor/EditorEstimatePage";

export const Route = createFileRoute("/editor/$projectId/estimate")({
	component: EditorEstimatePage,
});
