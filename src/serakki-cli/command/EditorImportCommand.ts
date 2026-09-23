import { basename, resolve } from "node:path";
import { Console, Effect } from "effect";
import { Argument, CliError, Command, Flag } from "effect/unstable/cli";

import { resolveSerakkiUserDataPathsFx } from "~/application-data/fx/resolveSerakkiUserDataPathsFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { createFilesystemEditorProjectRepositoryFx } from "~/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import { importEditorSelectedResourceFilesFx } from "~/resource-authoring/fx/importEditorSelectedResourceFilesFx";

const toUserErrorFn = (cause: unknown) =>
	new CliError.UserError({
		cause,
		userMessage: cause instanceof Error ? cause.message : "Editor resource import failed.",
	});

const importFilesFx = Effect.fn("importEditorFilesCliFx")(function* ({
	files,
	projectId: candidate,
	type,
}: {
	readonly files: ReadonlyArray<string>;
	readonly projectId: string;
	readonly type: "artwork" | "music" | "sfx";
}) {
	const projectId = yield* Effect.try({
		try: () => IdSchema.parse(candidate),
		catch: (cause) => cause,
	});
	const paths = yield* resolveSerakkiUserDataPathsFx;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const repository = yield* Effect.acquireRelease(
				createFilesystemEditorProjectRepositoryFx({
					catalogPath: paths.editor.catalog,
					projectsRoot: paths.editor.projects,
				}),
				(repository) => repository.closeFx,
			);
			const imported = yield* importEditorSelectedResourceFilesFx({
				files: files.map((file) => ({
					name: basename(file),
					path: resolve(file),
				})),
				projectId,
				repository,
				type,
			});
			yield* Console.log(
				imported.resources.map(({ uid, title }) => `${title}\t${uid}`).join("\n"),
			);
		}),
	);
});

const importTypeCommandFn = (type: "artwork" | "music" | "sfx") =>
	Command.make(
		type,
		{
			projectId: Argument.String("projectId"),
			files: Flag.String("file").pipe(
				Flag.atLeast(1),
				Flag.withDescription("Source file to import; repeat --file for multiple files."),
			),
		},
		({ projectId, files }) =>
			importFilesFx({
				files,
				projectId,
				type,
			}).pipe(Effect.mapError(toUserErrorFn)),
	).pipe(Command.withDescription(`Import ${type} files into an Editor project.`));

export const EditorImportCommand = Command.make("import")
	.pipe(
		Command.withSubcommands([
			importTypeCommandFn("artwork"),
			importTypeCommandFn("music"),
			importTypeCommandFn("sfx"),
		]),
	)
	.pipe(Command.withDescription("Import local files into an Editor project by project ID."));
