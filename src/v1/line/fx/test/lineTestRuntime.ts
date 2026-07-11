import { setItemFx } from "~/v1/runtime/fx/setItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

export const lineTestConfig = GameConfigSchema.parse({
	version: "1.0",
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
	start: {},
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
	return setItemFx({
		item: {
			id: "origin",
			item: lineTestConfig.items.source,
			quantity: 1,
			scope: "board",
			x: 5,
			y: 5,
		} satisfies RuntimeItemSchema.Type,
		scope: "board",
		x: 5,
		y: 5,
	});
};

export const placeLineTestItemFx = ({
	itemId,
	x,
}: {
	itemId: "permit" | "booster" | "blocker";
	x: number;
}) => {
	return setItemFx({
		item: {
			id: itemId,
			item: lineTestConfig.items[itemId],
			quantity: 1,
			scope: "inventory",
			x,
			y: 0,
		} satisfies RuntimeItemSchema.Type,
		scope: "inventory",
		x,
		y: 0,
	});
};
