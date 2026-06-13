import { GameItemView } from "~/item/ui/GameItemView";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { RectLike } from "~/play/types";

export namespace Tile {
	export interface Props {
		item: ViewItem;
		quantity?: number;
		producer?: BoardViewItem["producer"];
		dragOverlay?: boolean;
		overlaySize?: Pick<RectLike, "width" | "height"> | null;
	}
}

export function Tile({ item, quantity, producer, dragOverlay, overlaySize }: Tile.Props) {
	return (
		<GameItemView
			item={item}
			variant={dragOverlay ? "drag" : "board"}
			quantity={quantity}
			producer={producer}
			overlaySize={overlaySize}
		/>
	);
}
