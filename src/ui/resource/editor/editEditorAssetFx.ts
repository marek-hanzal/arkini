import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/publishEditorProjectFx";
import { validateEditorAssetFileFx } from "~/renderer/editor/resource/validateEditorAssetFileFx";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { renameGameResourceFx } from "~/game-config/resource/renameGameResourceFx";

export namespace editEditorAssetFx {
	export interface Props {
		readonly currentId: string;
		readonly file?: File;
		readonly projectId: string;
		readonly resourceId: string;
	}
}

/** Atomically renames one resource, its references, and optionally its PNG bytes. */
export const editEditorAssetFx = Effect.fn("editEditorAssetFx")(function* ({
	currentId,
	file,
	projectId,
	resourceId: candidateId,
}: editEditorAssetFx.Props) {
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(candidateId.trim()),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-resource-id",
				message: "Asset ID must not be empty.",
				cause,
			}),
	});
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.readProjectFx(projectId);
			const existing = project?.resources.find(({ id }) => id === currentId);
			if (project === null || existing === undefined) {
				return yield* Effect.fail(
					new EditorProjectError({
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
