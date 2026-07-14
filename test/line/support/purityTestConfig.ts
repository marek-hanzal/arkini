import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

const baseItem = ({ id, maxStackSize = 10 }: { id: string; maxStackSize?: number }) => ({
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
	scope: "any" as const,
	maxStackSize,
});

export const purityTestConfig = GameConfigSchema.parse({
	version: "1.0",
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
	start: {},
	categories: {},
	items: {
		material: {
			...baseItem({
				id: "material",
			}),
			type: "simple",
		},
		producer: {
			...baseItem({
				id: "producer",
			}),
			type: "producer",
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
								type: "value",
								value: 1,
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
								type: "value",
								value: 1,
							},
							capacity: 2,
						},
					],
					rules: [],
				},
			],
		},
		craft: {
			...baseItem({
				id: "craft",
			}),
			type: "craft",
			charges: {
				amount: 1,
			},
			line: {
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
							type: "value",
							value: 1,
						},
					},
				],
				rules: [],
			},
		},
		stash: {
			...baseItem({
				id: "stash",
			}),
			type: "stash",
			charges: {
				amount: 1,
			},
			line: {
				id: "line:stash",
				title: "Stash",
				description: "One stash line.",
				runtimeMs: 1_000,
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "material",
						},
						quantity: {
							type: "value",
							value: 1,
						},
					},
				],
				rules: [],
			},
		},
	},
});
