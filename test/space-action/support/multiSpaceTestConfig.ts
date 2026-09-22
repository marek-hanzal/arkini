import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = ({ id }: { id: string }) => ({
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
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			rules: [],
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
	},
	start: {
		currentSpace: 0,
	},
	items: {
		portal: {
			...baseItem({
				id: "portal",
			}),

			action: {
				type: "space" as const,
				space: 1,
			},
		},
		origin: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "origin",
			}),
		},
		log: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "log",
			}),
		},
		blocker: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "blocker",
			}),
		},
		mergeSource: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "mergeSource",
			}),

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
			}),
		},
		payer: {
			maxQueueSize: 1,
			lines: [],

			...baseItem({
				id: "payer",
			}),

			units: {
				amount: 1,
			},
		},
		workshop: {
			...baseItem({
				id: "workshop",
			}),

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
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemId: "log",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
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
			}),

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
			}),

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
			}),

			lines: [],
			maxQueueSize: 1,
			clock: {
				durationMs: 600,
				enable: true,
				rules: [],
				onExpire: guaranteedOutput("log"),
			},
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
