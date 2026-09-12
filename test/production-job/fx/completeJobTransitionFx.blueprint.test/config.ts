import type { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({
	id,
	maxCount,
	scope = "board",
	maxStackSize = 1,
}: {
	id: string;
	maxCount?: number;
	scope?: "any" | "board";
	maxStackSize?: number;
}) =>
	ItemSchema.parse({
		maxQueueSize: 1,
		lines: [],

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
		maxCount,
		maxStackSize,
	});

const blueprintItem = ({
	id,
	lineId,
	output,
	reserveTool = false,
}: {
	id: string;
	lineId: string;
	output?: z.input<typeof OutputSchema>;
	reserveTool?: boolean;
}) =>
	ItemSchema.parse({
		uid: id,
		id,

		units: {
			amount: 1,
		},
		title: id,
		description: id,
		asset: {
			scale: 0.8,
			default: [
				`asset:${id}`,
			],
		},
		scope: "board" as const,
		maxStackSize: 1,
		lines: [
			{
				ahead: true,
				id: lineId,
				title: lineId,
				description: lineId,
				runtimeMs: 200,
				input: reserveTool
					? [
							{
								type: "materials" as const,
								units: {
									from: "self" as const,
									cost: 1,
								},
								selector: {
									type: "item" as const,
									itemId: "item:tool",
								},
								mode: "reserve" as const,
								quantity: {
									min: 1,
									max: 1,
								},
							},
						]
					: [
							{
								type: "simple" as const,
								units: {
									from: "self" as const,
									cost: 1,
								},
							},
						],
				output,
				rules: [],
			},
		],
	});

const guaranteedOutput = (
	drops: ReadonlyArray<{
		itemId: string;
		quantity: z.input<typeof QuantitySchema>;
		placement?: "drop";
	}>,
) =>
	OutputSchema.parse({
		set: [
			{
				roll: [
					{
						type: "guaranteed" as const,
						drop: drops.map(({ itemId, quantity, placement = "drop" }) => ({
							itemId,
							quantity,
							placement,
							rules: [],
						})),
					},
				],
			},
		],
	});

const blueprintOutput = (
	primaryItemId: string,
	byproducts: ReadonlyArray<{
		itemId: string;
		quantity: z.input<typeof QuantitySchema>;
	}> = [],
) =>
	guaranteedOutput([
		{
			itemId: primaryItemId,
			quantity: {
				min: 1,
				max: 1,
			},
			placement: "drop",
		},
		...byproducts,
	]);

export const blueprintConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:blueprint-completion",
		title: "Blueprint completion",
		board: {
			width: 3,
			height: 2,
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
		"blueprint:plain": blueprintItem({
			id: "blueprint:plain",
			lineId: "line:blueprint:plain",
			output: blueprintOutput("item:target"),
		}),
		"blueprint:capped": {
			...blueprintItem({
				id: "blueprint:capped",
				lineId: "line:blueprint:capped",
				output: blueprintOutput("item:target"),
			}),
			maxCount: 1,
		},
		"blueprint:output": blueprintItem({
			id: "blueprint:output",
			lineId: "line:blueprint:output",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:byproduct",
					quantity: {
						min: 1,
						max: 1,
					},
				},
			]),
		}),
		"blueprint:reserve": blueprintItem({
			id: "blueprint:reserve",
			lineId: "line:blueprint:reserve",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:byproduct",
					quantity: {
						min: 1,
						max: 1,
					},
				},
			]),
			reserveTool: true,
		}),
		"blueprint:range": blueprintItem({
			id: "blueprint:range",
			lineId: "line:blueprint:range",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:limited",
					quantity: {
						min: 1,
						max: 5,
					},
				},
			]),
		}),
		"blueprint:depletion-capped": {
			...blueprintItem({
				id: "blueprint:depletion-capped",
				lineId: "line:blueprint:depletion-capped",
				output: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			units: {
				amount: 1,
				output: blueprintOutput("item:depletion-product"),
			},
		},
		"blueprint:depletion-self": {
			...blueprintItem({
				id: "blueprint:depletion-self",
				lineId: "line:blueprint:depletion-self",
				output: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			units: {
				amount: 1,
				output: blueprintOutput("blueprint:depletion-self"),
			},
			maxCount: 1,
		},
		"blueprint:depletion-random": {
			...blueprintItem({
				id: "blueprint:depletion-random",
				lineId: "line:blueprint:depletion-random",
				output: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			units: {
				amount: 1,
				output: {
					set: [
						{
							roll: [
								{
									type: "weight",
									quantity: {
										min: 1,
										max: 1,
									},
									drop: [
										{
											weight: 1,
											drop: [
												{
													itemId: "item:target-unlimited",
													quantity: {
														min: 1,
														max: 1,
													},
													placement: "drop",
													rules: [],
												},
											],
										},
										{
											weight: 1,
											drop: [
												{
													itemId: "item:depletion-product",
													quantity: {
														min: 1,
														max: 1,
													},
													placement: "drop",
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			},
		},
		"blueprint:depletion-self-no-output": {
			...blueprintItem({
				id: "blueprint:depletion-self-no-output",
				lineId: "line:blueprint:depletion-self-no-output",
				output: blueprintOutput("blueprint:depletion-self-no-output"),
				reserveTool: true,
			}),
			maxCount: 1,
		},
		"blueprint:hop-a": blueprintItem({
			id: "blueprint:hop-a",
			lineId: "line:blueprint:hop-a",
			output: blueprintOutput("blueprint:hop-b"),
		}),
		"blueprint:hop-b": blueprintItem({
			id: "blueprint:hop-b",
			lineId: "line:blueprint:hop-b",
			output: guaranteedOutput([
				{
					itemId: "blueprint:hop-a",
					quantity: {
						min: 1,
						max: 1,
					},
				},
				{
					itemId: "item:target",
					quantity: {
						min: 1,
						max: 1,
					},
				},
			]),
		}),
		"item:target": simpleItem({
			id: "item:target",
			maxCount: 1,
		}),
		"item:target-unlimited": simpleItem({
			id: "item:target-unlimited",
		}),
		"item:byproduct": simpleItem({
			id: "item:byproduct",
			maxCount: 2,
			maxStackSize: 2,
		}),
		"item:limited": simpleItem({
			id: "item:limited",
			maxCount: 4,
		}),
		"item:depletion-product": simpleItem({
			id: "item:depletion-product",
			maxCount: 1,
		}),
		"item:tool": simpleItem({
			id: "item:tool",
		}),
		"item:blocker": simpleItem({
			id: "item:blocker",
		}),
		"item:queue-product": simpleItem({
			id: "item:queue-product",
			maxCount: 1,
		}),
		"item:shared": simpleItem({
			id: "item:shared",
			maxCount: 2,
		}),
		"producer:limited": {
			uid: "producer:limited",
			id: "producer:limited",

			title: "Limited producer",
			description: "Produces one singleton output.",
			asset: {
				scale: 0.8,
				default: [
					"asset:producer:limited",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:producer:limited",
					title: "Produce",
					description: "Produce one singleton.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: guaranteedOutput([
						{
							itemId: "item:queue-product",
							quantity: {
								min: 1,
								max: 1,
							},
						},
					]),
					rules: [],
				},
			],
		},
		"producer:blueprint-source": {
			uid: "producer:blueprint-source",
			id: "producer:blueprint-source",

			title: "Blueprint source",
			description: "Produces one purpose-bound blueprint.",
			asset: {
				scale: 0.8,
				default: [
					"asset:producer:blueprint-source",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:producer:blueprint-source",
					title: "Produce blueprint",
					description: "Produce one blueprint.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:plain"),
					rules: [],
				},
				{
					id: "line:producer:capped-blueprint",
					title: "Produce capped blueprint",
					description: "Produce one capped purpose-bound blueprint.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:capped"),
					rules: [],
				},
				{
					id: "line:producer:ordinary-material",
					title: "Produce ordinary material",
					description: "Produce one ordinary material.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("item:target-unlimited"),
					rules: [],
				},
				{
					id: "line:producer:safe-blueprint",
					title: "Produce safe blueprint",
					description: "Produce one blueprint with a usable immediate line.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:output"),
					rules: [],
				},
				{
					id: "line:producer:random-blueprint",
					title: "Produce random result",
					description: "May produce a capped dead-end blueprint.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										type: "weight",
										quantity: {
											min: 1,
											max: 1,
										},
										drop: [
											{
												weight: 1,
												drop: [
													{
														itemId: "item:target-unlimited",
														quantity: {
															min: 1,
															max: 1,
														},
														placement: "drop",
														rules: [],
													},
												],
											},
											{
												weight: 1,
												drop: [
													{
														itemId: "blueprint:plain",
														quantity: {
															min: 1,
															max: 1,
														},
														placement: "drop",
														rules: [],
													},
												],
											},
										],
									},
								],
							},
						],
					},
					rules: [],
				},
				{
					id: "line:producer:correlated-blueprint",
					title: "Produce correlated result",
					description: "Produces either one blueprint or its one capped result.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										type: "weight",
										quantity: {
											min: 1,
											max: 1,
										},
										drop: [
											{
												weight: 1,
												drop: [
													{
														itemId: "blueprint:plain",
														quantity: {
															min: 1,
															max: 1,
														},
														placement: "drop",
														rules: [],
													},
												],
											},
											{
												weight: 1,
												drop: [
													{
														itemId: "item:target",
														quantity: {
															min: 1,
															max: 1,
														},
														placement: "drop",
														rules: [],
													},
												],
											},
										],
									},
								],
							},
						],
					},
					rules: [],
				},
				{
					id: "line:producer:two-hop-cycle",
					title: "Produce bounded cycle",
					description: "Produces a blueprint whose next hop enters a bounded cycle.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:hop-a"),
					rules: [],
				},
				{
					id: "line:producer:lifecycle-blueprint",
					title: "Produce lifecycle blueprint",
					description: "Produces a blueprint whose final unit has a capped branch.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:depletion-random"),
					rules: [],
				},
			],
		},
		"producer:shared-source": {
			uid: "producer:shared-source",
			id: "producer:shared-source",

			title: "Shared source",
			description: "Produces the shared capped item.",
			asset: {
				scale: 0.8,
				default: [
					"asset:producer:shared-source",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer:shared-source",
					title: "Produce shared",
					description: "Produce one shared item.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("item:shared"),
					rules: [],
				},
			],
		},
		"producer:shared-consumer": {
			uid: "producer:shared-consumer",
			id: "producer:shared-consumer",

			title: "Shared consumer",
			description: "Consumes the shared capped item without producing it.",
			asset: {
				scale: 0.8,
				default: [
					"asset:producer:shared-consumer",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer:shared-consumer",
					title: "Consume shared",
					description: "Consume one shared item.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "item:shared",
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
		"producer:recycler": {
			uid: "producer:recycler",
			id: "producer:recycler",

			title: "Recycler",
			description: "Replaces one capped item with one capped item.",
			asset: {
				scale: 0.8,
				default: [
					"asset:producer:recycler",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer:recycler",
					title: "Recycle",
					description: "Consume and replace the same item.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "item:target",
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					output: blueprintOutput("item:target"),
					rules: [],
				},
			],
		},
		"producer:spent-stack": {
			uid: "producer:spent-stack",
			id: "producer:spent-stack",

			title: "Finite stack",
			description: "Replaces exactly one depleted stacked owner.",
			asset: {
				scale: 0.8,
				default: [
					"asset:producer:spent-stack",
				],
			},
			scope: "board",
			maxStackSize: 3,
			maxCount: 3,
			maxQueueSize: 1,
			units: {
				amount: 1,
			},
			lines: [
				{
					id: "line:producer:spent-stack",
					title: "Renew one",
					description: "Spend the final owner unit and replace one owner.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					output: blueprintOutput("producer:spent-stack"),
					rules: [],
				},
			],
		},
	},
} satisfies z.input<typeof GameConfigSchema>);
