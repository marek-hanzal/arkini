import { createFileRoute } from "@tanstack/react-router";

import { EditorChatGptPage } from "~/page/editor/EditorChatGptPage";

export const Route = createFileRoute("/editor/$projectId/chatgpt")({
	component: EditorChatGptPage,
});
