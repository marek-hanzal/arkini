import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({ id }: { id: string }) => ({
	uid: id,
	id,
	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

export const lineSelectionTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:line-selection",
		title: "Line selection",
		board: {
			width: 4,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		material: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "material",
			}),
		},
		producer: {
			maxQueueSize: 1,

			...baseItem({
				id: "producer",
			}),

			lines: [
				{
					id: "line:producer:zero",
					title: "Zero capacity",
					description: "A line with one exact input.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "material",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		craft: {
			maxQueueSize: 1,

			...baseItem({
				id: "craft",
			}),

			units: {
				amount: 1,
			},
			lines: [
				{
					id: "line:craft",
					title: "Craft",
					description: "One single-use line.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "material",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
	},
});
