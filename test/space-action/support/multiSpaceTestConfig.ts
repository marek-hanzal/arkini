import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({
	id,
	maxStackSize = 1,
	scope = "any",
}: {
	id: string;
	maxStackSize?: number;
	scope?: "any" | "board";
}) => ({
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
								min: 1,
								max: 1,
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
	items: {
		portal: {
			...baseItem({
				id: "portal",
				scope: "board",
			}),
			type: "space",
			space: 1,
		},
		origin: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "origin",
				scope: "board",
			}),
			type: "common",
		},
		log: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "log",
				maxStackSize: 3,
			}),
			type: "common",
		},
		blocker: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "blocker",
				scope: "board",
			}),
			type: "common",
		},
		mergeSource: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "mergeSource",
			}),
			type: "common",
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
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "mergeTarget",
				scope: "board",
			}),
			type: "common",
		},
		payer: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "payer",
				scope: "board",
			}),
			type: "common",
			units: {
				amount: 1,
			},
		},
		workshop: {
			...baseItem({
				id: "workshop",
				scope: "board",
			}),
			type: "common",
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
								min: 1,
								max: 1,
							},
							capacity: 1,
							mode: "consume",
						},
					],
					rules: [],
				},
			],
		},
		unitsProducer: {
			...baseItem({
				id: "unitsProducer",
				scope: "board",
			}),
			type: "common",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:units:run",
					title: "Units",
					description: "Uses one nearby payer unit.",
					runtimeMs: 200,
					input: [
						{
							type: "units",
							query: {
								scope: "board",
								distance: "far",
								selector: {
									type: "item",
									itemId: "payer",
								},
							},
							units: {
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
			type: "common",
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
