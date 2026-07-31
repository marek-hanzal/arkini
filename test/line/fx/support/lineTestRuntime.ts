import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export const lineTestConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:line-test",
		title: "Line test",
		board: {
			width: 10,
			height: 10,
		},
		inventory: {
			width: 3,
			height: 3,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		source: {
			uid: "source",
			id: "source",
			title: "Source",
			description: "A line origin.",
			asset: {
				default: [
					"asset:source",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
		permit: {
			uid: "permit",
			id: "permit",
			title: "Permit",
			description: "Allows a product line.",
			asset: {
				default: [
					"asset:permit",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 1,
			type: "simple",
		},
		booster: {
			uid: "booster",
			id: "booster",
			title: "Booster",
			description: "Changes a product-line runtime.",
			asset: {
				default: [
					"asset:booster",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 1,
			type: "simple",
		},
		blocker: {
			uid: "blocker",
			id: "blocker",
			title: "Blocker",
			description: "Disables and hides a product line.",
			asset: {
				default: [
					"asset:blocker",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 1,
			type: "simple",
		},
	},
});

export const existsWhen = (itemId: string) => {
	return {
		query: {
			scope: "any" as const,
			selector: {
				itemId,
				type: "item" as const,
			},
		},
		type: "exists" as const,
	};
};

export const createOriginFx = () => {
	return spawnItemFx({
		id: "origin",
		itemId: "source",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 5,
				y: 5,
			},
		},
		quantity: 1,
	});
};

export const placeLineTestItemFx = ({
	itemId,
	x,
}: {
	itemId: "permit" | "booster" | "blocker";
	x: number;
}) => {
	return spawnItemFx({
		id: itemId,
		itemId,
		location: {
			scope: "inventory",
			position: {
				x,
				y: 0,
			},
		},
		quantity: 1,
	});
};
