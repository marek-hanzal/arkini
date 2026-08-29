import { Effect } from "effect";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { publishEditorProjectFx } from "~/ui/editor/publishEditorProjectFx";
import {
	type EditorAssetFileInput,
	validateEditorAssetFileFx,
} from "~/renderer/editor/resource/validateEditorAssetFileFx";

export namespace saveEditorAssetFx {
	export interface Props {
		readonly expectedRevision: number;
		readonly file: EditorAssetFileInput;
		readonly overwrite: boolean;
		readonly projectId: string;
		readonly resourceId: string;
	}
}

/** Validates and inserts or explicitly replaces one Editor PNG. */
export const saveEditorAssetFx = Effect.fn("saveEditorAssetFx")(function* ({
	expectedRevision,
	file,
	overwrite,
	projectId,
	resourceId,
}: saveEditorAssetFx.Props) {
	const resource = yield* validateEditorAssetFileFx(file, resourceId.trim());
	const repository = yield* EditorProjectRepository;
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
			return {
				project,
				resourceIds: [
					resource.id,
				],
			};
		}),
	);
});
