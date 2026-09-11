import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

/** Held artwork is a face projection; actor metadata retains the committed item projection. */
export const readActorVisualItemFn = ({
	dragging,
	item,
}: {
	readonly dragging: boolean;
	readonly item: TileActorItem;
}): TileActorItem =>
	dragging && item.nativeArtwork !== undefined
		? {
				...item,
				sourceUrl: item.nativeArtwork.sourceUrl,
				compositeUrl: item.nativeArtwork.compositeUrl,
			}
		: item;
