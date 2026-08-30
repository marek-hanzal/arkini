import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { EditorWelcome } from "~/project-authoring/ui/EditorWelcome";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";

export const Route = createFileRoute("/editor/welcome")({
	loader: ({ abortController, context }) =>
		context.rendererRuntime.runPromise(
			Effect.flatMap(EditorProjectRepository, (repository) => repository.listProjectsFx),
			{
				signal: abortController.signal,
			},
		),
	component: () => (
		<LauncherPageLayout
			labelledBy="editor-welcome-title"
			page="editor-welcome"
		>
			<EditorWelcome recentProjects={Route.useLoaderData()} />
		</LauncherPageLayout>
	),
});
