import { Effect } from "effect";

import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export const dropRuleTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
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
	start: {
		currentSpace: 0,
	},
	items: {
		source: {
			uid: "source",
			id: "source",
			title: "Source",
			description: "A drop origin.",
			asset: {
				default: [
					"asset:source",
				],
			},
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
		permit: {
			uid: "permit",
			id: "permit",
			title: "Permit",
			description: "An availability token.",
			asset: {
				default: [
					"asset:permit",
				],
			},
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

export const placePermitFx = () => {
	return spawnItemFx({
		id: "permit-stack",
		itemId: "permit",
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 2,
	}).pipe(Effect.asVoid);
};
