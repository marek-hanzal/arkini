import { createFileRoute } from "@tanstack/react-router";
import { Effect, Exit } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { YourGames } from "~/serapack-selector/ui/YourGames";

export const Route = createFileRoute("/_launcher/serapacks")({
	loader: ({ abortController, context }) =>
		context.rendererRuntime.runPromise(
			Effect.exit(
				Effect.flatMap(ProjectRepository, (repository) => repository.listProjectsFx),
			),
			{
				signal: abortController.signal,
			},
		),
	component: () => {
		const projectCatalog = Route.useLoaderData();
		return (
			<YourGames
				projects={Exit.isSuccess(projectCatalog) ? projectCatalog.value : []}
				projectCatalogError={
					Exit.isFailure(projectCatalog) ? projectCatalog.cause : undefined
				}
			/>
		);
	},
});
