import { useMemo } from "react";
import { useResourceUrls } from "~/authoring-session/ui/ResourceUrlSession";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Maps recipe image identities to the canonical project Asset URLs, owned by the shared URL session. */
export const useTilePaintingImageUrls = (
	images: ReadonlyArray<TilePaintingDocumentSchema.Image>,
) => {
	const resourceIds = useMemo(
		() => images.map((image) => image.sourceResourceId),
		[
			images,
		],
	);
	const urls = useResourceUrls(resourceIds);
	return useMemo(
		() =>
			new Map(
				images.map((image) => [
					image.id,
					urls.get(image.sourceResourceId),
				]),
			),
		[
			images,
			urls,
		],
	);
};
