import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetsPage } from "~/page/editor/EditorAssetsPage";

export const Route = createFileRoute("/editor/$projectId/assets")({
	component: EditorAssetsPage,
});
