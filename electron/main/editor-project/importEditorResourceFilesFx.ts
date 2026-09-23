import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { extractSerapackFileFx } from "~/serapack-admission/fx/extractSerapackFileFx";
import { importEditorSelectedResourceFilesFx } from "~/resource-authoring/fx/importEditorSelectedResourceFilesFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

const failFn = (message: string, cause?: unknown) =>
	new ProjectRepositoryError({
		operation: "upsert-resource",
		message,
		cause,
	});

/** Imports selected files without crossing IPC with their binary bodies. */
export const importEditorResourceFilesFx = Effect.fn("importEditorResourceFilesFx")(function* ({
	repository,
	request,
}: {
	readonly repository: OwnedEditorProjectRepository;
	readonly request: EditorProjectTransport.ImportResourcesRequest;
}) {
	if (request.source === "files") {
		const result = yield* importEditorSelectedResourceFilesFx({
			files: request.files,
			projectId: request.projectId,
			repository,
			type: request.type,
		});
		return {
			project: result.project,
			resourceUids: result.resources.map(({ uid }) => uid),
		};
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
			resources: resources.map(({ uid, path, size, type }) => ({
				uid,
				path,
				size,
				type,
				title: uid,
			})),
		});
		return {
			project,
			resourceUids: resources.map(({ uid }) => uid),
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
