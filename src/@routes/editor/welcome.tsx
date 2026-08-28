import { createFileRoute } from "@tanstack/react-router";

import { listEditorProjectsFx } from "~/bridge/editor/listEditorProjectsFx";
import { EditorWelcome } from "~/ui/editor/EditorWelcome";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const Route = createFileRoute("/editor/welcome")({
	loader: ({ abortController, context }) =>
		context.rendererRuntime.runPromise(listEditorProjectsFx(), {
			signal: abortController.signal,
		}),
	component: () => (
		<MainPageLayout
			labelledBy="editor-welcome-title"
			page="editor-welcome"
		>
			<EditorWelcome recentProjects={Route.useLoaderData()} />
		</MainPageLayout>
	),
});
