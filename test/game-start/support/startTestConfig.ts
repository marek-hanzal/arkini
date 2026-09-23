import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({ id }: { id: string }) => {
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
	templates: [
		{
			uid: "start",
			title: "Start",
			width: 3,
			height: 2,
			board: [
				{
					itemId: "tree",
					x: 1,
					y: 1,
				},
			],
		},
	],
	start: {
		currentSpace: 0,
		spaces: [
			{
				space: 0,
				templateUid: "start",
			},
		],
	},
	items: {
		tree: simpleItem({
			id: "tree",
		}),
		log: simpleItem({
			id: "log",
		}),
		lens: simpleItem({
			id: "lens",
		}),
	},
});
