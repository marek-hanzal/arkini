import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

const baseItem = ({
	id,
	maxStackSize = 1,
	scope = "any",
}: {
	id: string;
	maxStackSize?: number;
	scope?: "any" | "board";
}) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope,
	maxStackSize,
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						{
							itemId,
							quantity: {
								type: "value" as const,
								value: 1,
							},
							placement: "drop" as const,
							rules: [],
						},
					],
				},
			],
		},
	],
});

export const multiSpaceTestConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:multi-space",
		title: "Multi-space test",
		board: {
			width: 3,
			height: 1,
		},
		inventory: {
			width: 3,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		origin: {
			...baseItem({
				id: "origin",
				scope: "board",
			}),
			type: "simple",
		},
		log: {
			...baseItem({
				id: "log",
				maxStackSize: 3,
			}),
			type: "simple",
		},
		blocker: {
			...baseItem({
				id: "blocker",
				scope: "board",
			}),
			type: "simple",
		},
		mergeSource: {
			...baseItem({
				id: "mergeSource",
			}),
			type: "simple",
			merge: [
				{
					target: {
						type: "item",
						itemId: "mergeTarget",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
		mergeTarget: {
			...baseItem({
				id: "mergeTarget",
				scope: "board",
			}),
			type: "simple",
		},
		payer: {
			...baseItem({
				id: "payer",
				scope: "board",
			}),
			type: "simple",
			charges: {
				amount: 1,
			},
		},
		workshop: {
			...baseItem({
				id: "workshop",
				scope: "board",
			}),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:workshop:material",
					title: "Material",
					description: "Stores one log.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "log",
							},
							quantity: {
								type: "value",
								value: 1,
							},
							capacity: 1,
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
		depositProducer: {
			...baseItem({
				id: "depositProducer",
				scope: "board",
			}),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:deposit:run",
					title: "Deposit",
					description: "Uses one nearby payer charge.",
					runtimeMs: 200,
					input: [
						{
							type: "deposit",
							query: {
								scope: "board",
								distance: "far",
								selector: {
									type: "item",
									itemId: "payer",
								},
							},
							charges: {
								from: "target",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		worker: {
			...baseItem({
				id: "worker",
				scope: "board",
			}),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:worker:run",
					title: "Run",
					description: "Produces one log.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: guaranteedOutput("log"),
					rules: [],
				},
			],
		},
		temporary: {
			...baseItem({
				id: "temporary",
				scope: "board",
			}),
			type: "temporary",
			durationMs: 600,
			output: guaranteedOutput("log"),
		},
	},
});

export const boardLocation = (space: number, x: number) => ({
	scope: "board" as const,
	space,
	position: {
		x,
		y: 0,
	},
});

export const inventoryLocation = (x: number) => ({
	scope: "inventory" as const,
	position: {
		x,
		y: 0,
	},
});
