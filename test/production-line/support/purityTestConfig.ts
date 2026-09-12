import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({ id, maxStackSize = 10 }: { id: string; maxStackSize?: number }) => ({
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
	scope: "any" as const,
	maxStackSize,
});

export const purityTestConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:purity",
		title: "Purity",
		board: {
			width: 4,
			height: 1,
		},
		inventory: {
			width: 2,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
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
							selector: {
								type: "item",
								itemId: "material",
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					rules: [],
				},
				{
					id: "line:producer:buffer",
					title: "Buffered",
					description: "A line with storage capacity.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "material",
							},
							quantity: {
								min: 1,
								max: 1,
							},
							capacity: 2,
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
							selector: {
								type: "item",
								itemId: "material",
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
