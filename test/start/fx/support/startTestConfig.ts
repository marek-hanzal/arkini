import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

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
	},
	start: {
		board: [
			{
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
	},
});
