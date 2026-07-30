import { createFileRoute } from "@tanstack/react-router";

import { listEditorProjectsFx } from "~/bridge/editor/listEditorProjectsFx";
import { EditorWelcomePage } from "~/page/editor/EditorWelcomePage";

function EditorWelcomeRoute() {
	return <EditorWelcomePage recentProjects={Route.useLoaderData()} />;
}

export const Route = createFileRoute("/editor/welcome")({
	loader: ({ abortController, context }) =>
		context.rendererRuntime.runPromise(listEditorProjectsFx(), {
			signal: abortController.signal,
		}),
	component: EditorWelcomeRoute,
});
