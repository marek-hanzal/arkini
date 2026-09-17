import { Effect } from "effect";

import { AudioResourceMetadataSchema } from "~/audio-authoring/schema/AudioResourceMetadataSchema";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Saves Editor-only audio metadata and publishes the canonical resource list before releasing admission. */
export const saveEditorAudioMetadataFx = Effect.fn("saveEditorAudioMetadataFx")(function* (
	props: ProjectRepository.SaveResourceMetadataProps,
) {
	const metadata = yield* Effect.try({
		try: () =>
			AudioResourceMetadataSchema.parse({
				name: props.name,
			}),
		catch: (cause) =>
			new ProjectRepositoryError({
				operation: "save-resource-metadata",
				message: "Audio name must not be empty.",
				cause,
			}),
	});
	const repository = yield* ProjectRepository;
	const admission = yield* ProjectWriteAdmission;
	yield* Effect.yieldNow;
	return yield* admission.admitWriteFx(
		"save-resource-metadata",
		Effect.uninterruptible(
			Effect.gen(function* () {
				const project = yield* repository.saveResourceMetadataFx({
					...props,
					name: metadata.name,
				});
				yield* publishEditorProjectFx(props.projectId, {
					project,
				});
				return project;
			}),
		),
	);
});
