import { createFileRoute } from "@tanstack/react-router";

import { EditorBoardPage } from "~/page/editor/EditorBoardPage";

export const Route = createFileRoute("/editor/$projectId/board")({
	component: EditorBoardPage,
});
