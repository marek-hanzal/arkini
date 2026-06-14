import type { FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { RectLike } from "~/play/types";

export namespace Tile {
	export interface Props {
		item: ViewItem;
		quantity?: number;
		activation?: BoardViewItem["activation"];
		dragOverlay?: boolean;
		overlaySize?: Pick<RectLike, "width" | "height">;
	}
}

export const Tile: FC<Tile.Props> = ({ item, quantity, activation, dragOverlay, overlaySize }) => {
	return (
		<GameItemView
			item={item}
			variant={dragOverlay ? "drag" : "board"}
			quantity={quantity}
			activation={activation}
			overlaySize={overlaySize}
		/>
	);
};
