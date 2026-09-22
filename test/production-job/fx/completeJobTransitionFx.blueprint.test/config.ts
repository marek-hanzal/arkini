import type { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({ id }: { id: string }) =>
	ItemSchema.parse({
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
		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},

		lines: [
			{
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
								query: {
									distance: "far" as const,
									selector: {
										type: "item" as const,
										itemId: "item:tool",
									},
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
				rules: [],
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
						...blueprintOutput("item:target-unlimited").set,
						...blueprintOutput("item:depletion-product").set,
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
		},
		"item:target": simpleItem({
			id: "item:target",
		}),
		"item:target-unlimited": simpleItem({
			id: "item:target-unlimited",
		}),
		"item:byproduct": simpleItem({
			id: "item:byproduct",
		}),
		"item:limited": simpleItem({
			id: "item:limited",
		}),
		"item:depletion-product": simpleItem({
			id: "item:depletion-product",
		}),
		"item:tool": simpleItem({
			id: "item:tool",
		}),
		"item:blocker": simpleItem({
			id: "item:blocker",
		}),
		"item:queue-product": simpleItem({
			id: "item:queue-product",
		}),
		"item:shared": simpleItem({
			id: "item:shared",
		}),
		"producer:limited": {
			uid: "producer:limited",
			id: "producer:limited",

			title: "Limited producer",
			description: "Produces one singleton output.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer:limited",
				],
			},

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
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer:blueprint-source",
				],
			},

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
			],
		},
		"producer:shared-source": {
			uid: "producer:shared-source",
			id: "producer:shared-source",

			title: "Shared source",
			description: "Produces the shared capped item.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer:shared-source",
				],
			},

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
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer:shared-consumer",
				],
			},

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
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "item:shared",
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
		"producer:recycler": {
			uid: "producer:recycler",
			id: "producer:recycler",

			title: "Recycler",
			description: "Replaces one capped item with one capped item.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer:recycler",
				],
			},

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
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "item:target",
								},
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
		"producer:depleted-owner": {
			uid: "producer:depleted-owner",
			id: "producer:depleted-owner",

			title: "Finite owner",
			description: "Replaces the depleted owner.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer:depleted-owner",
				],
			},

			maxQueueSize: 1,
			units: {
				amount: 1,
			},
			lines: [
				{
					id: "line:producer:depleted-owner",
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
					output: blueprintOutput("producer:depleted-owner"),
					rules: [],
				},
			],
		},
	},
} satisfies z.input<typeof GameConfigSchema>);
