import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { validateEditorArtworkFileFx } from "~/artwork-authoring/fx/validateEditorArtworkFileFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { renameGameResourceFx } from "~/game-config-resource/fx/renameGameResourceFx";

interface EditEditorArtworkProps {
	readonly currentId: string;
	readonly file?: File;
	readonly projectId: string;
	readonly resourceId: string;
}

/** Atomically renames one resource, its references, and optionally its PNG bytes. */
export const editEditorArtworkFx = Effect.fn("editEditorArtworkFx")(function* ({
	currentId,
	file,
	projectId,
	resourceId: candidateId,
}: EditEditorArtworkProps) {
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(candidateId.trim()),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: "Artwork ID must not be empty.",
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
				const existing = project?.resources.find(({ id }) => id === currentId);
				if (project === null || existing?.type !== "artwork") {
					return yield* Effect.fail(
						new ProjectOperationError({
							reason: "invalid-artwork",
							message: `Artwork ${currentId} no longer exists.`,
						}),
					);
				}
				const resource =
					file === undefined
						? {
								type: existing.type,
								id: resourceId,
							}
						: {
								...(yield* validateEditorArtworkFileFx(file, resourceId)),
								path: window.arkini.file.readPathFn(file),
							};
				const config = yield* renameGameResourceFx({
					config: project.config,
					from: currentId,
					to: resourceId,
				});
				const saved = yield* repository.replaceResourceFx({
					config,
					currentId,
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
