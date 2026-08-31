import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorWelcome } from "~/project-authoring/ui/EditorWelcome";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";

export const Route = createFileRoute("/editor/welcome")({
	loader: ({ abortController, context }) =>
		context.rendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) => repository.listProjectsFx),
			{
				signal: abortController.signal,
			},
		),
	component: () => (
		<LauncherPageLayout page="editor-welcome">
			<EditorWelcome recentProjects={Route.useLoaderData()} />
		</LauncherPageLayout>
	),
});
