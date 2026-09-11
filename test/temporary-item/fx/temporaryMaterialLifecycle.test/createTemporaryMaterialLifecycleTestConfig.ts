import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const baseItem = (id: string, maxStackSize = 1) => ({
	uid: id,
	id,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	layer: "content" as const,
	scope: "board" as const,
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

export const createTemporaryMaterialLifecycleTestConfig = (runtimeMs = 1_000) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:temporary-material-lifecycle",
			title: "Temporary material lifecycle",
			board: {
				width: 3,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		items: {
			owner: {
				...baseItem("owner"),
				type: "producer",
				maxQueueSize: 2,
				lines: [
					{
						id: "line:owner",
						title: "Temporary material",
						description: "Consumes one or two temporary materials.",
						runtimeMs,
						input: [
							{
								type: "materials",
								selector: {
									type: "item",
									itemId: "temporary",
								},
								quantity: {
									min: 1,
									max: 2,
								},
								capacity: 0,
								mode: "consume",
							},
						],
						output: guaranteedOutput("product"),
						rules: [],
					},
				],
			},
			temporary: {
				...baseItem("temporary"),
				type: "temporary",
				durationMs: 600,
				output: guaranteedOutput("residue"),
			},
			residue: {
				...baseItem("residue", 10),
				type: "simple",
			},
			product: {
				...baseItem("product", 10),
				type: "simple",
			},
			blocker: {
				...baseItem("blocker"),
				type: "simple",
			},
		},
	});
