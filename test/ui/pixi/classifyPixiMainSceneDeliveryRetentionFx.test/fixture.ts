import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export const boardLocation = (x: number): TileActorItem["location"] => ({
	scope: "board",
	space: 0,
	position: {
		x,
		y: 0,
	},
});

export const createDeliveryItem = (
	id: string,
	overrides: Partial<TileActorItem> = {},
): TileActorItem => ({
	activityEffect: false,
	compositeUrl: undefined,
	id,
	itemId: "water",
	itemType: "simple",
	location: boardLocation(0),
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: `revision:${id}`,
	running: false,
	sourceUrl: "resource:water",
	title: "Water",
	...overrides,
});

export const createDeliveryActor = (item: TileActorItem) =>
	({
		container: {
			scale: {
				x: 1,
			},
			x: 40,
			y: 60,
		},
		currentVisual: {
			item,
		},
		dragging: false,
		item,
		size: 80,
	}) as PixiTileActor;
