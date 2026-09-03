import { Console, Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";

import { resolveArkiniUserDataPathsFx } from "~/application-data/fx/resolveArkiniUserDataPathsFx";
import { createFilesystemEditorProjectRepositoryFx } from "~/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx";

const listProjectsFx = Effect.scoped(
	Effect.gen(function* () {
		const paths = yield* resolveArkiniUserDataPathsFx;
		const repository = yield* Effect.acquireRelease(
			createFilesystemEditorProjectRepositoryFx({
				catalogPath: paths.editor.catalog,
				projectsRoot: paths.editor.projects,
			}),
			(repository) => repository.closeFx,
		);
		const projects = (yield* repository.listProjectsFx).flatMap((candidate) =>
			candidate.type === "valid"
				? [
						candidate.project,
					]
				: [],
		);
		const entries = projects.map(
			(project) => `Project: ${project.title}\nProject ID: ${project.projectId}`,
		);
		yield* Console.log(
			`=== Projects\n${entries.length === 0 ? "No Editor projects found." : entries.join("\n---\n")}`,
		);
	}),
);

const ProjectListCommand = Command.make("list", {}, () =>
	listProjectsFx.pipe(
		Effect.mapError(
			(cause) =>
				new CliError.UserError({
					cause,
					userMessage:
						cause instanceof Error
							? cause.message
							: "Editor projects could not be listed.",
				}),
		),
	),
).pipe(Command.withDescription("List available Editor projects by title and ID."));

export const ProjectCommand = Command.make("project")
	.pipe(
		Command.withSubcommands([
			ProjectListCommand,
		]),
	)
	.pipe(Command.withDescription("Local Editor project discovery commands."));
