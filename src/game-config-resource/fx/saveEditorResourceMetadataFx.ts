import { Effect } from "effect";

import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Saves Editor-only resource metadata and publishes the canonical resource list before releasing admission. */
export const saveEditorResourceMetadataFx = Effect.fn("saveEditorResourceMetadataFx")(function* (
	props: ProjectRepository.SaveResourceMetadataProps,
) {
	const metadata = yield* Effect.try({
		try: () =>
			ResourceMetadataSchema.parse({
				title: props.title,
			}),
		catch: (cause) =>
			new ProjectRepositoryError({
				operation: "save-resource-metadata",
				message: "Resource title must not be empty.",
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
					title: metadata.title,
				});
				yield* publishEditorProjectFx(props.projectId, {
					project,
				});
				return project;
			}),
		),
	);
});
