import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

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
		maxQueueSize: 1,
		lines: [],

		uid: id,
		id,
		title: id,
		description: id,
		asset: {
			scale: 0.8,
			default: [
				`asset:${id}`,
			],
		},
		scope,
		maxStackSize,
	} as const;
};

export const startTestConfig = GameConfigSchema.parse({
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
				position: {
					x: 0,
					y: 0,
				},
				quantity: 3,
			},
			{
				itemId: "log",
				position: {
					x: 1,
					y: 0,
				},
				quantity: 1,
			},
		],
		toolbar: [],
	},
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
			uid: "backpack",
			id: "backpack",
			action: {
				type: "inventory",
			},
			scope: "any",
			maxStackSize: 1,
			title: "Backpack",
			description: "Backpack",
			asset: {
				scale: 0.8,
				default: [
					"asset:backpack",
				],
			},
		},
	},
});
