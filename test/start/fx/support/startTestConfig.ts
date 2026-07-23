import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const simpleItem = ({
	id,
	maxStackSize,
	scope,
}: {
	id: string;
	maxStackSize: number;
	scope: "any" | "board" | "inventory";
}) => {
	return {
		id,
		title: id,
		description: id,
		asset: {
			source: [
				`asset:${id}`,
			],
		},
		tags: [],
		categoryId: "resource",
		scope,
		maxStackSize,
		type: "simple",
	} as const;
};

export const startTestConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:start",
		title: "Start",
		board: {
			width: 3,
			height: 2,
		},
		inventory: {
			width: 2,
			height: 1,
		},
		toolbarSize: 2,
	},
	start: {
		currentSpace: 0,
		board: [
			{
				space: 0,
				itemId: "tree",
				x: 1,
				y: 1,
			},
		],
		inventory: [
			{
				itemId: "log",
				quantity: 4,
			},
		],
		toolbar: [],
	},
	categories: {},
	items: {
		tree: simpleItem({
			id: "tree",
			maxStackSize: 1,
			scope: "board",
		}),
		log: simpleItem({
			id: "log",
			maxStackSize: 3,
			scope: "any",
		}),
		lens: simpleItem({
			id: "lens",
			maxStackSize: 2,
			scope: "inventory",
		}),
		backpack: {
			id: "backpack",
			type: "inventory",
			title: "Backpack",
			description: "Backpack",
			asset: {
				source: [
					"asset:backpack",
				],
			},
			tags: [],
			categoryId: "resource",
		},
	},
});
