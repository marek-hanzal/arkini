import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

export const item = {
	id: "runtime:water",
	itemId: "water",
	itemType: "simple",
	location: {
		scope: "inventory",
		position: {
			x: 1,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 4,
	revision: "revision:water",
	running: false,
	activityEffect: false,
	sourceUrl: "resource:water",
	title: "Water",
} satisfies TileActorItem;

export const spaceItem = {
	...item,
	itemType: "space",
	primaryAction: {
		currentSpace: 0,
		kind: "activate-space",
	},
} satisfies TileActorItem;
