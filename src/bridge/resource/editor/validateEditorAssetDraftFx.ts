import { Effect } from "effect";

import { validateEditorAssetFileFx } from "~/bridge/resource/editor/validateEditorAssetFileFx";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

/** Applies the canonical resource ID and PNG file contract before a dirty asset can be saved. */
export const validateEditorAssetDraftFx = Effect.fn("validateEditorAssetDraftFx")(function* ({
	file,
	resourceId: candidateId,
}: {
	readonly file?: File;
	readonly resourceId: string;
}) {
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(candidateId.trim()),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-resource-id",
				message: "Asset ID must not be empty.",
				cause,
			}),
	});
	if (file !== undefined) yield* validateEditorAssetFileFx(file, resourceId);
});
