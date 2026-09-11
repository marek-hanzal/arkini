import { Effect } from "effect";
import { createTilePaintingRendererFx } from "~/tile-painting/fx/createTilePaintingRendererFx";
import { TilePaintingRenderError } from "~/tile-painting/error/TilePaintingRenderError";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Export only authored layers and scatter at exact document size; reference and view are editor-only. */
export const renderTilePaintingPngFx = Effect.fn("renderTilePaintingPngFx")(function* (
	painting: TilePaintingDocumentSchema.Type,
) {
	const renderer = yield* createTilePaintingRendererFx(painting.images);
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
