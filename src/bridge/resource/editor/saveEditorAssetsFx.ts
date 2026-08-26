import { Effect } from "effect";

import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { upsertEditorResourcesFx } from "~/bridge/resource/editor/upsertEditorResourcesFx";
import {
	type EditorAssetFileInput,
	validateEditorAssetFileFx,
} from "~/bridge/resource/editor/validateEditorAssetFileFx";

export namespace saveEditorAssetsFx {
	export interface Props {
		readonly files: ReadonlyArray<EditorAssetFileInput>;
		readonly projectId: string;
	}
}

/** Validates one selected PNG batch and saves it into the canonical project. */
export const saveEditorAssetsFx = Effect.fn("saveEditorAssetsFx")(function* ({
	files,
	projectId,
}: saveEditorAssetsFx.Props) {
	if (files.length === 0) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: "Select at least one PNG asset to import.",
			}),
		);
	}
	const resources = yield* Effect.forEach(files, (file) => validateEditorAssetFileFx(file), {
		concurrency: 4,
	});
	const resourceIds = new Set<string>();
	for (const resource of resources) {
		if (resourceIds.has(resource.id)) {
			return yield* Effect.fail(
				new EditorProjectError({
					reason: "invalid-resource-id",
					message: `Asset ID ${resource.id} occurs more than once in the selected batch.`,
				}),
			);
		}
		resourceIds.add(resource.id);
	}
	return yield* upsertEditorResourcesFx({
		projectId,
		resources,
	});
});
