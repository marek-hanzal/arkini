import { createFileRoute } from "@tanstack/react-router";

import { EditorMusicManager } from "~/music-authoring/ui/EditorMusicManager";

export const Route = createFileRoute("/editor/$projectId/music")({
	component: EditorMusicManager,
});
