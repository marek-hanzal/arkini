import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({ id, maxStackSize }: { id: string; maxStackSize: number }) => {
	return {
		maxQueueSize: 1,
		lines: [],

		uid: id,
		id,
		title: id,
		description: id,
		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},
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
	},
	items: {
		tree: simpleItem({
			id: "tree",
			maxStackSize: 1,
		}),
		log: simpleItem({
			id: "log",
			maxStackSize: 3,
		}),
		lens: simpleItem({
			id: "lens",
			maxStackSize: 2,
		}),
		backpack: {
			uid: "backpack",
			id: "backpack",

			maxStackSize: 1,
			title: "Backpack",
			description: "Backpack",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:backpack",
				],
			},
		},
	},
});
