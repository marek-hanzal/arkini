import { createFileRoute } from "@tanstack/react-router";

import { EditorSfxManager } from "~/sfx-authoring/ui/EditorSfxManager";

export const Route = createFileRoute("/editor/$projectId/sfx")({
	component: EditorSfxManager,
});
