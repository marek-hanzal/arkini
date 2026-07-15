import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

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
			id: "source",
			title: "Source",
			description: "A line origin.",
			asset: {
				source: [
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
			id: "permit",
			title: "Permit",
			description: "Allows a product line.",
			asset: {
				source: [
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
			id: "booster",
			title: "Booster",
			description: "Changes a product-line runtime.",
			asset: {
				source: [
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
			id: "blocker",
			title: "Blocker",
			description: "Disables and hides a product line.",
			asset: {
				source: [
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
