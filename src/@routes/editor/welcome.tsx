import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorWelcome } from "~/project-authoring/welcome/EditorWelcome";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const Route = createFileRoute("/editor/welcome")({
	loader: ({ abortController, context }) =>
		context.rendererRuntime.runPromise(
			Effect.flatMap(EditorProjectRepository, (repository) => repository.listProjectsFx),
			{
				signal: abortController.signal,
			},
		),
	component: () => (
		<MainPageLayout
			labelledBy="editor-welcome-title"
			page="editor-welcome"
		>
			<EditorWelcome recentProjects={Route.useLoaderData()} />
		</MainPageLayout>
	),
});
