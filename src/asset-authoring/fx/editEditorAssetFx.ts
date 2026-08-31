import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { validateEditorAssetFileFx } from "~/asset-authoring/fx/validateEditorAssetFileFx";
import { IdSchema } from "~/game-config/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { renameGameResourceFx } from "~/game-config-resource/fx/renameGameResourceFx";

interface EditEditorAssetProps {
	readonly currentId: string;
	readonly file?: File;
	readonly projectId: string;
	readonly resourceId: string;
}

/** Atomically renames one resource, its references, and optionally its PNG bytes. */
export const editEditorAssetFx = Effect.fn("editEditorAssetFx")(function* ({
	currentId,
	file,
	projectId,
	resourceId: candidateId,
}: EditEditorAssetProps) {
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(candidateId.trim()),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: "Asset ID must not be empty.",
				cause,
			}),
	});
	const repository = yield* ProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.readProjectFx(projectId);
			const existing = project?.resources.find(({ id }) => id === currentId);
			if (project === null || existing === undefined) {
				return yield* Effect.fail(
					new ProjectOperationError({
						reason: "invalid-asset",
						message: `Asset ${currentId} no longer exists.`,
					}),
				);
			}
			const resource =
				file === undefined
					? {
							...existing,
							id: resourceId,
						}
					: yield* validateEditorAssetFileFx(file, resourceId);
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
	);
});
