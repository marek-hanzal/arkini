import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { validateEditorArtworkFileFx } from "~/artwork-authoring/fx/validateEditorArtworkFileFx";
import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";

interface EditEditorArtworkProps {
	readonly title: string;
	readonly file?: File;
	readonly projectId: string;
	readonly resourceUid: string;
}

/** Updates artwork title and optional PNG bytes while preserving its UID. */
export const editEditorArtworkFx = Effect.fn("editEditorArtworkFx")(function* ({
	title: candidateTitle,
	file,
	projectId,
	resourceUid,
}: EditEditorArtworkProps) {
	const { title } = yield* Effect.try({
		try: () =>
			ResourceMetadataSchema.parse({
				title: candidateTitle,
			}),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-title",
				message: "Artwork title must not be empty.",
				cause,
			}),
	});
	const repository = yield* ProjectRepository;
	const admission = yield* ProjectWriteAdmission;
	yield* Effect.yieldNow;
	return yield* admission.admitWriteFx(
		"replace-resource",
		Effect.uninterruptible(
			Effect.gen(function* () {
				const project = yield* repository.readProjectFx(projectId);
				const existing = project?.resources.find(({ uid }) => uid === resourceUid);
				if (project === null || existing?.type !== "artwork") {
					return yield* Effect.fail(
						new ProjectOperationError({
							reason: "invalid-artwork",
							message: `Artwork ${resourceUid} no longer exists.`,
						}),
					);
				}
				const resource =
					file === undefined
						? {
								type: existing.type,
								uid: resourceUid,
								title,
							}
						: {
								...(yield* validateEditorArtworkFileFx(file, resourceUid)),
								path: window.serakki.file.readPathFn(file),
								title,
							};
				const saved = yield* repository.replaceResourceFx({
					resourceUid,
					expectedRevision: project.revision,
					projectId,
					resource,
				});
				yield* publishEditorProjectFx(projectId, {
					project: saved,
				});
				return saved;
			}),
		),
	);
});
