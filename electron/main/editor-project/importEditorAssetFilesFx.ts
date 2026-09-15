import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { extractArkpackFileFx } from "~/arkpack-admission/fx/extractArkpackFileFx";
import { readEditorAssetResourceIdFn } from "~/asset-authoring/fn/readEditorAssetResourceIdFn";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

const failFn = (message: string, cause?: unknown) =>
	new ProjectRepositoryError({
		operation: "upsert-resource",
		message,
		cause,
	});

const readPngFilesFx = Effect.fn("importEditorAssetFilesFx.readPngFilesFx")(
	(files: EditorProjectTransport.ImportAssetsRequest["files"]) =>
		Effect.forEach(
			files,
			(file) =>
				Effect.gen(function* () {
					if (!file.name.toLowerCase().endsWith(".png"))
						return yield* Effect.fail(failFn(`Asset ${file.name} must be a PNG.`));
					const id = yield* Effect.try({
						try: () => IdSchema.parse(readEditorAssetResourceIdFn(file.name)),
						catch: (cause) =>
							failFn(
								`Asset ${file.name} does not produce a valid resource ID.`,
								cause,
							),
					});
					const size = yield* validatePngResourceFileFx(file.path, id).pipe(
						Effect.mapError((cause) => failFn(cause.message, cause)),
					);
					return {
						id,
						mime: "image/png" as const,
						path: file.path,
						size,
					};
				}),
			{
				concurrency: 4,
			},
		),
);

/** Imports selected files without crossing IPC with their binary bodies. */
export const importEditorAssetFilesFx = Effect.fn("importEditorAssetFilesFx")(function* ({
	repository,
	request,
}: {
	readonly repository: OwnedEditorProjectRepository;
	readonly request: EditorProjectTransport.ImportAssetsRequest;
}) {
	if (request.source === "files") {
		const resources = yield* readPngFilesFx(request.files);
		const project = yield* repository.upsertResourceFilesFx({
			projectId: request.projectId,
			resources,
		});
		return {
			project,
			resourceIds: resources.map(({ id }) => id),
		};
	}

	if (request.files.length !== 1)
		return yield* Effect.fail(failFn("Select one Arkpack to import."));
	const file = request.files[0];
	if (!file.name.toLowerCase().endsWith(".arkpack"))
		return yield* Effect.fail(failFn("Choose a .arkpack file."));
	const temporaryRoot = yield* Effect.tryPromise({
		try: () => mkdtemp(join(tmpdir(), "arkini-asset-import-")),
		catch: (cause) => failFn("The Arkpack could not be unpacked.", cause),
	});
	return yield* Effect.gen(function* () {
		const arkpack = yield* extractArkpackFileFx({
			arkpackPath: file.path,
			outputRoot: temporaryRoot,
		});
		if (arkpack.resources.length === 0)
			return yield* Effect.fail(failFn("The selected Arkpack does not contain any assets."));
		const project = yield* repository.upsertResourceFilesFx({
			projectId: request.projectId,
			resources: arkpack.resources.map(({ id, path, size }) => ({
				id,
				mime: "image/png" as const,
				path,
				size,
			})),
		});
		return {
			project,
			resourceIds: arkpack.resources.map(({ id }) => id),
		};
	}).pipe(
		Effect.mapError((cause) =>
			cause instanceof ProjectRepositoryError
				? cause
				: failFn("The selected Arkpack is invalid.", cause),
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
