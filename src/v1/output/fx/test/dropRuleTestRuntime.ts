import { Effect } from "effect";

import { setItemFx } from "~/v1/runtime/fx/setItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

export const dropRuleTestConfig = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:drop-rule-test",
		title: "Drop rule test",
		board: {
			width: 10,
			height: 10,
		},
		inventory: {
			width: 2,
			height: 2,
		},
	},
	start: {},
	categories: {},
	items: {
		source: {
			id: "source",
			title: "Source",
			description: "A drop origin.",
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
			description: "An availability token.",
			asset: {
				source: [
					"asset:permit",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

export const permitQuery = {
	scope: "any" as const,
	selector: {
		type: "item" as const,
		itemId: "permit",
	},
};

export const createDropRuleOriginFx = () => {
	return setItemFx({
		item: {
			id: "origin",
			item: dropRuleTestConfig.items.source,
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

export const placePermitFx = () => {
	return setItemFx({
		item: {
			id: "permit-stack",
			item: dropRuleTestConfig.items.permit,
			quantity: 2,
			scope: "inventory",
			x: 0,
			y: 0,
		} satisfies RuntimeItemSchema.Type,
		scope: "inventory",
		x: 0,
		y: 0,
	}).pipe(Effect.asVoid);
};
