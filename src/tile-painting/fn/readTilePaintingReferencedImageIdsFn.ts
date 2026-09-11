import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** References used by persisted painting setup; unused captured images have no source dependency. */
export const readTilePaintingReferencedImageIdsFn = (
	document: TilePaintingDocumentSchema.Type,
): ReadonlySet<string> => {
	const ids = new Set<string>();
	for (const layer of document.layers) {
		ids.add(layer.imageId);
		for (const stroke of layer.strokes)
			if (stroke.shape === "image" && stroke.brushImageId !== null)
				ids.add(stroke.brushImageId);
	}
	for (const item of document.catalog) ids.add(item.imageId);
	for (const stroke of document.scatter)
		for (const stamp of stroke.stamps) ids.add(stamp.imageId);
	if (document.reference !== null) ids.add(document.reference.imageId);
	for (const cell of document.preview.cells) if (cell?.kind === "image") ids.add(cell.imageId);
	return ids;
};
