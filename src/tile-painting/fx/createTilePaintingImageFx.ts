import { readTilePaintingPngSupportFn } from "~/tile-painting/fn/readTilePaintingPngSupportFn";
import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";

/** Copies admitted PNG bytes into the painting so asset replacement cannot change its recipe. */
export const createTilePaintingImageFx = Effect.fn("createTilePaintingImageFx")(function* (
	resource: ResourceSchema.Type,
) {
	// Resource admission already proves PNG integrity; reject painter-specific limits before changing its draft.
	if (!readTilePaintingPngSupportFn(resource.bytes))
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-asset",
				message:
					"Painting images must be single-frame PNGs no larger than 2048 × 2048 pixels.",
			}),
		);
	return yield* Effect.sync((): TilePaintingDocumentSchema.Type["images"][number] => {
		let binary = "";
		for (let offset = 0; offset < resource.bytes.length; offset += 8192) {
			binary += String.fromCharCode(...resource.bytes.subarray(offset, offset + 8192));
		}
		return {
			id: createId(),
			label: resource.id,
			sourceResourceId: resource.id,
			png: `data:image/png;base64,${btoa(binary)}`,
		};
	});
});
