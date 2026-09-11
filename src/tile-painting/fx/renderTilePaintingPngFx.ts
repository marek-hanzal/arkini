import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { readTilePaintingReferencedImageIdsFn } from "~/tile-painting/fn/readTilePaintingReferencedImageIdsFn";
import { Effect } from "effect";
import { createTilePaintingRendererFx } from "~/tile-painting/fx/createTilePaintingRendererFx";
import { TilePaintingRenderError } from "~/tile-painting/error/TilePaintingRenderError";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Export only authored layers and scatter at exact document size; reference and view are editor-only. */
export const renderTilePaintingPngFx = Effect.fn("renderTilePaintingPngFx")(function* (
	painting: TilePaintingDocumentSchema.Type,
	resources: ReadonlyArray<ResourceSchema.Type>,
) {
	const renderedDocument = {
		...painting,
		layers: painting.layers.filter((layer) => layer.visible && layer.opacity > 0),
		reference: null,
		preview: {
			columns: 1,
			rows: 1,
			cells: [
				null,
			],
		},
		catalog: [],
	};
	const referenced = readTilePaintingReferencedImageIdsFn(renderedDocument);
	const renderer = yield* createTilePaintingRendererFx(
		painting.images.filter((image) => referenced.has(image.id)),
		resources,
	);
	const canvas = yield* Effect.sync(() => document.createElement("canvas"));
	yield* renderer.renderFx({
		document: painting,
		canvas,
	});
	return yield* Effect.try({
		try: () => canvas.toDataURL("image/png"),
		catch: (cause) =>
			new TilePaintingRenderError({
				message: "Could not export the painting PNG.",
				cause,
			}),
	});
});
