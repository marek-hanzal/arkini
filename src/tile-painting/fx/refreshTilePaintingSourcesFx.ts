import { readTilePaintingReferencedImageIdsFn } from "~/tile-painting/fn/readTilePaintingReferencedImageIdsFn";
import { Effect, Encoding } from "effect";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { readTilePaintingPngSupportFn } from "~/tile-painting/fn/readTilePaintingPngSupportFn";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

export namespace refreshTilePaintingSourcesFx {
	export interface Props {
		readonly document: TilePaintingDocumentSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		/** A batch may postpone guide-only outputs until all output bytes exist. */
		readonly deferredResourceIds?: ReadonlySet<string>;
	}
}

/** Explicit Bake refreshes the working snapshots from canonical Assets; ordinary Save never does. */
export const refreshTilePaintingSourcesFx = Effect.fn("refreshTilePaintingSourcesFx")(function* ({
	document,
	resources,
	deferredResourceIds,
}: refreshTilePaintingSourcesFx.Props) {
	const sources = new Map(
		resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	const images: Array<TilePaintingDocumentSchema.Image> = [];
	const referenced = readTilePaintingReferencedImageIdsFn(document);
	for (const image of document.images) {
		if (!referenced.has(image.id)) {
			images.push(image);
			continue;
		}
		const resource = sources.get(image.sourceResourceId);
		if (resource === undefined) {
			if (deferredResourceIds?.has(image.sourceResourceId)) {
				images.push(image);
				continue;
			}
			return yield* Effect.fail(
				new ProjectOperationError({
					reason: "invalid-asset",
					message: `Source asset ${image.sourceResourceId} is missing. Restore it before baking ${document.name}.`,
				}),
			);
		}
		if (!readTilePaintingPngSupportFn(resource.bytes))
			return yield* Effect.fail(
				new ProjectOperationError({
					reason: "invalid-asset",
					message: `Source asset ${resource.id} must be a single-frame PNG no larger than 2048 × 2048 pixels.`,
				}),
			);
		images.push({
			...image,
			png: `data:image/png;base64,${Encoding.encodeBase64(resource.bytes)}`,
		});
	}
	return {
		...document,
		images,
	} satisfies TilePaintingDocumentSchema.Type;
});
