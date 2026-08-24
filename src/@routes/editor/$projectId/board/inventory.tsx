import { createFileRoute } from "@tanstack/react-router";

import { EditorBoardInventoryPage } from "~/page/editor/EditorBoardInventoryPage";

export const Route = createFileRoute("/editor/$projectId/board/inventory")({
	component: EditorBoardInventoryPage,
});
