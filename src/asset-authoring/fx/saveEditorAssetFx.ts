import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import {
	type EditorAssetFileInput,
	validateEditorAssetFileFx,
} from "~/asset-authoring/fx/validateEditorAssetFileFx";

interface SaveEditorAssetProps {
	readonly expectedRevision: number;
	readonly file: EditorAssetFileInput;
	readonly overwrite: boolean;
	readonly projectId: string;
	readonly resourceId: string;
}

/** Validates and inserts or explicitly replaces one Editor PNG. */
export const saveEditorAssetFx = Effect.fn("saveEditorAssetFx")(function* ({
	expectedRevision,
	file,
	overwrite,
	projectId,
	resourceId,
}: SaveEditorAssetProps) {
	const resource = yield* validateEditorAssetFileFx(file, resourceId.trim());
	const repository = yield* ProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.saveResourceFx({
				expectedRevision,
				overwrite,
				projectId,
				resource,
			});
			yield* publishEditorProjectFx(projectId, {
				project,
			});
			return project;
		}),
	);
});
