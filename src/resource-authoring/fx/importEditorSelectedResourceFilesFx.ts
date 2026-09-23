import { createId } from "@paralleldrive/cuid2";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Effect } from "effect";

import { prepareEditorAudioFileFx } from "~/audio-authoring/fx/prepareEditorAudioFileFx";
import { validateArtworkPngFileFx } from "~/game-config-resource/fx/validateArtworkPngFileFx";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

const failFn = (message: string, cause?: unknown) =>
	new ProjectRepositoryError({
		operation: "upsert-resource",
		message,
		cause,
	});

const titleFromFilenameFn = (filename: string) =>
	basename(filename)
		.replace(/\.[^.]*$/, "")
		.replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")
		.replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1 $2")
		.replace(/[_.-]+/g, " ")
		.trim()
		.split(/\s+/u)
		.map((word) => `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`)
		.join(" ");

/** Imports explicit local files through the Editor's canonical resource write boundary. */
export const importEditorSelectedResourceFilesFx = Effect.fn("importEditorSelectedResourceFilesFx")(
	function* ({
		files,
		projectId,
		repository,
		type,
	}: {
		readonly files: ReadonlyArray<{
			readonly name: string;
			readonly path: string;
		}>;
		readonly projectId: string;
		readonly repository: OwnedEditorProjectRepository;
		readonly type: "artwork" | "image" | "music" | "sfx";
	}) {
		if (files.length === 0)
			return yield* Effect.fail(failFn("Select at least one resource to import."));
		const project = yield* repository.readProjectFx(projectId);
		if (project === null)
			return yield* Effect.fail(failFn(`Editor project ${projectId} does not exist.`));

		if (type === "artwork" || type === "image") {
			const resources = yield* Effect.forEach(
				files,
				(file) =>
					Effect.gen(function* () {
						if (!file.name.toLowerCase().endsWith(".png"))
							return yield* Effect.fail(
								failFn(`${type} ${file.name} must be a PNG.`),
							);
						const uid = createId();
						const size = yield* (
							type === "artwork"
								? validateArtworkPngFileFx(file.path, uid)
								: validatePngResourceFileFx(file.path, uid)
						).pipe(Effect.mapError((cause) => failFn(cause.message, cause)));
						return {
							uid,
							type,
							title: titleFromFilenameFn(file.name),
							path: file.path,
							size,
						};
					}),
				{
					concurrency: 4,
				},
			);
			const saved = yield* repository.upsertResourceFilesFx({
				projectId,
				resources,
			});
			return {
				project: saved,
				resources,
			};
		}

		const temporaryRoot = yield* Effect.tryPromise({
			try: () => mkdtemp(join(tmpdir(), "serakki-audio-import-")),
			catch: (cause) => failFn("Audio import could not create temporary output.", cause),
		});
		return yield* Effect.gen(function* () {
			const resources = yield* Effect.forEach(
				files,
				(file, index) =>
					Effect.gen(function* () {
						const uid = createId();
						const prepared = yield* prepareEditorAudioFileFx({
							uid,
							source: file.path,
							target: join(temporaryRoot, `${index}.ogg`),
						}).pipe(Effect.mapError((cause) => failFn(cause.message, cause)));
						return {
							uid,
							type,
							title: titleFromFilenameFn(file.name),
							path: prepared.path,
							size: prepared.size,
						};
					}),
				{
					concurrency: 1,
				},
			);
			const saved = yield* repository.upsertResourceFilesFx({
				projectId,
				resources,
			});
			return {
				project: saved,
				resources,
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
	},
);
