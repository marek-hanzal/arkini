import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const simpleItem = (id: string) => ({
	uid: id,
	id,
	type: "simple" as const,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "any" as const,
	maxStackSize: 8,
});

export const directionalMergeConfig = GameConfigSchema.parse({
	resources: {
		hero: "asset:item:double-tree",
	},
	meta: {
		id: "game:directional-merge",
		title: "Directional merge",
		board: {
			width: 4,
			height: 3,
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
		"item:water": {
			...simpleItem("item:water"),
			merge: [
				{
					target: {
						type: "item",
						itemId: "item:tree",
					},
					action: "consume",
					effect: "replace",
					result: "item:double-tree",
				},
			],
		},
		"item:tree": simpleItem("item:tree"),
		"item:double-tree": simpleItem("item:double-tree"),
	},
});
