import { createId } from "@paralleldrive/cuid2";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { readInitialAudioResourceNameFn } from "~/audio-authoring/fn/readInitialAudioResourceNameFn";
import { Effect } from "effect";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { extractSerapackFileFx } from "~/serapack-admission/fx/extractSerapackFileFx";
import { readImportedResourceIdFn } from "~/game-config-resource/fn/readImportedResourceIdFn";
import { validateArtworkPngFileFx } from "~/game-config-resource/fx/validateArtworkPngFileFx";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { prepareEditorAudioFileFx } from "~/audio-authoring/fx/prepareEditorAudioFileFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

const failFn = (message: string, cause?: unknown) =>
	new ProjectRepositoryError({
		operation: "upsert-resource",
		message,
		cause,
	});

const readPngFilesFx = Effect.fn("importEditorResourceFilesFx.readPngFilesFx")(
	({ files, type }: Pick<EditorProjectTransport.ImportResourcesRequest, "files" | "type">) =>
		Effect.forEach(
			files,
			(file) =>
				Effect.gen(function* () {
					if (!file.name.toLowerCase().endsWith(".png"))
						return yield* Effect.fail(failFn(`${type} ${file.name} must be a PNG.`));
					const id = yield* Effect.try({
						try: () => IdSchema.parse(readImportedResourceIdFn(file.name)),
						catch: (cause) =>
							failFn(
								`${type} ${file.name} does not produce a valid resource ID.`,
								cause,
							),
					});
					const size = yield* (
						type === "artwork"
							? validateArtworkPngFileFx(file.path, id)
							: validatePngResourceFileFx(file.path, id)
					).pipe(Effect.mapError((cause) => failFn(cause.message, cause)));
					return {
						id,
						type,
						path: file.path,
						size,
					};
				}),
			{
				concurrency: 4,
			},
		),
);

const readAudioFilesFx = Effect.fn("importEditorResourceFilesFx.readAudioFilesFx")(
	({
		files,
		temporaryRoot,
		type,
	}: Pick<EditorProjectTransport.ImportResourcesRequest, "files" | "type"> & {
		readonly temporaryRoot: string;
	}) =>
		Effect.forEach(
			files,
			(file, index) =>
				Effect.gen(function* () {
					const id = createId();
					const name =
						basename(file.name)
							.replace(/\.[^.]*$/, "")
							.replace(/[_-]+/g, " ")
							.trim() || "Audio";
					const prepared = yield* prepareEditorAudioFileFx({
						id,
						source: file.path,
						target: join(temporaryRoot, `${index}.ogg`),
					}).pipe(Effect.mapError((cause) => failFn(cause.message, cause)));
					return {
						id,
						type: type as "music" | "sfx",
						name,
						path: prepared.path,
						size: prepared.size,
					};
				}),
			{
				concurrency: 1,
			},
		),
);

/** Imports selected files without crossing IPC with their binary bodies. */
export const importEditorResourceFilesFx = Effect.fn("importEditorResourceFilesFx")(function* ({
	repository,
	request,
}: {
	readonly repository: OwnedEditorProjectRepository;
	readonly request: EditorProjectTransport.ImportResourcesRequest;
}) {
	if (request.source === "files") {
		if (request.type === "artwork" || request.type === "image") {
			const resources = yield* readPngFilesFx(request);
			const project = yield* repository.upsertResourceFilesFx({
				projectId: request.projectId,
				resources,
			});
			return {
				project,
				resourceIds: resources.map(({ id }) => id),
			};
		}
		const temporaryRoot = yield* Effect.tryPromise({
			try: () => mkdtemp(join(tmpdir(), "serakki-audio-import-")),
			catch: (cause) => failFn("Audio import could not create temporary output.", cause),
		});
		return yield* Effect.gen(function* () {
			const resources = yield* readAudioFilesFx({
				files: request.files,
				temporaryRoot,
				type: request.type,
			});
			const project = yield* repository.upsertResourceFilesFx({
				projectId: request.projectId,
				resources,
			});
			return {
				project,
				resourceIds: resources.map(({ id }) => id),
			};
		}).pipe(
			Effect.ensuring(
				Effect.promise(() =>
					rm(temporaryRoot, {
						force: true,
						recursive: true,
					}),
				).pipe(Effect.ignore),
			),
		);
	}

	if (request.files.length !== 1)
		return yield* Effect.fail(failFn("Select one Serapack to import."));
	const file = request.files[0];
	if (!file.name.toLowerCase().endsWith(".serapack"))
		return yield* Effect.fail(failFn("Choose a .serapack file."));
	const temporaryRoot = yield* Effect.tryPromise({
		try: () => mkdtemp(join(tmpdir(), "serakki-resource-import-")),
		catch: (cause) => failFn("The Serapack could not be unpacked.", cause),
	});
	return yield* Effect.gen(function* () {
		const serapack = yield* extractSerapackFileFx({
			serapackPath: file.path,
			outputRoot: temporaryRoot,
		});
		const resources = serapack.resources.filter(({ type }) => type === request.type);
		if (resources.length === 0)
			return yield* Effect.fail(
				failFn(`The selected Serapack does not contain any ${request.type}.`),
			);
		const project = yield* repository.upsertResourceFilesFx({
			projectId: request.projectId,
			resources: resources.map(({ id, path, size, type }) => ({
				...(type === "music" || type === "sfx"
					? {
							name: readInitialAudioResourceNameFn(id),
						}
					: {}),
				id,
				type,
				path,
				size,
			})),
		});
		return {
			project,
			resourceIds: resources.map(({ id }) => id),
		};
	}).pipe(
		Effect.mapError((cause) =>
			cause instanceof ProjectRepositoryError
				? cause
				: failFn("The selected Serapack is invalid.", cause),
		),
		Effect.ensuring(
			Effect.promise(() =>
				rm(temporaryRoot, {
					force: true,
					recursive: true,
				}),
			).pipe(Effect.ignore),
		),
	);
});
