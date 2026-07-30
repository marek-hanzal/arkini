import { createFileRoute } from "@tanstack/react-router";

import { EditorWelcomePage } from "~/page/editor/EditorWelcomePage";

export const Route = createFileRoute("/editor/welcome")({
	component: EditorWelcomePage,
});
