import type { TileActorPlacement } from "~/ui/tile/TileActorPlacement";

interface RectLike {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export namespace readTileDeliveryOriginOffset {
	export interface Props {
		readonly actorLayerRect: RectLike;
		readonly originRect: RectLike;
		readonly targetPlacement: TileActorPlacement;
	}

	export interface Result {
		readonly x: number;
		readonly y: number;
	}
}

/** Reads the origin-to-target center delta inside the one Canvas actor layer. */
export const readTileDeliveryOriginOffset = ({
	actorLayerRect,
	originRect,
	targetPlacement,
}: readTileDeliveryOriginOffset.Props): readTileDeliveryOriginOffset.Result => ({
	x:
		originRect.left +
		originRect.width / 2 -
		(actorLayerRect.left + targetPlacement.x + targetPlacement.width / 2),
	y:
		originRect.top +
		originRect.height / 2 -
		(actorLayerRect.top + targetPlacement.y + targetPlacement.height / 2),
});
