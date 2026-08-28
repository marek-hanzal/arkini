import { createFileRoute } from "@tanstack/react-router";

import { EditorBoardPlayablePage } from "~/page/editor/EditorBoardPlayablePage";

export const Route = createFileRoute("/editor/$projectId/board/")({
	component: EditorBoardPlayablePage,
});
