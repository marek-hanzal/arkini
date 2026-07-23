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
		readonly originAnchor?: "center" | "directional-edge";
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
	originAnchor = "center",
}: readTileDeliveryOriginOffset.Props): readTileDeliveryOriginOffset.Result => {
	const originCenter = {
		x: originRect.left + originRect.width / 2,
		y: originRect.top + originRect.height / 2,
	};
	const targetCenter = {
		x: actorLayerRect.left + targetPlacement.x + targetPlacement.width / 2,
		y: actorLayerRect.top + targetPlacement.y + targetPlacement.height / 2,
	};
	if (originAnchor === "center") {
		return {
			x: originCenter.x - targetCenter.x,
			y: originCenter.y - targetCenter.y,
		};
	}
	const delta = {
		x: targetCenter.x - originCenter.x,
		y: targetCenter.y - originCenter.y,
	};
	const length = Math.hypot(delta.x, delta.y);
	if (!Number.isFinite(length) || length < 0.001) {
		return {
			x: originCenter.x - targetCenter.x,
			y: originCenter.y - targetCenter.y,
		};
	}
	const direction = {
		x: delta.x / length,
		y: delta.y / length,
	};
	const horizontalEdgeDistance =
		Math.abs(direction.x) < 0.001
			? Number.POSITIVE_INFINITY
			: originRect.width / 2 / Math.abs(direction.x);
	const verticalEdgeDistance =
		Math.abs(direction.y) < 0.001
			? Number.POSITIVE_INFINITY
			: originRect.height / 2 / Math.abs(direction.y);
	const mouthDistance = Math.min(horizontalEdgeDistance, verticalEdgeDistance) * 0.78;
	return {
		x: originCenter.x + direction.x * mouthDistance - targetCenter.x,
		y: originCenter.y + direction.y * mouthDistance - targetCenter.y,
	};
};
