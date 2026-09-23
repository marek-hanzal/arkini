import type { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const simpleItem = ({ id }: { id: string }) =>
	ItemSchema.parse({
		maxQueueSize: 1,
		lines: [],

		uid: id,

		title: id,
		description: id,
		ui: "simple",
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
	outcome,
	reserveTool = false,
}: {
	id: string;
	lineId: string;
	outcome?: z.input<typeof OutcomeTableSchema>;
	reserveTool?: boolean;
}) =>
	ItemSchema.parse({
		uid: id,

		units: {
			amount: 1,
		},
		title: id,
		description: id,
		ui: "default",
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
										itemUid: "item:tool",
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
				outcome,
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
	OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed" as const,
						outcome: drops.map(({ itemId, quantity, placement = "drop" }) => ({
							type: "item" as const,
							itemUid: itemId,
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
		spaces: [],
	},
	items: {
		"blueprint:plain": blueprintItem({
			id: "blueprint:plain",
			lineId: "line:blueprint:plain",
			outcome: blueprintOutput("item:target"),
		}),
		"blueprint:outcome": blueprintItem({
			id: "blueprint:outcome",
			lineId: "line:blueprint:outcome",
			outcome: blueprintOutput("item:target-unlimited", [
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
			outcome: blueprintOutput("item:target-unlimited", [
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
			outcome: blueprintOutput("item:target-unlimited", [
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
				outcome: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			units: {
				amount: 1,
				outcome: blueprintOutput("item:depletion-product"),
			},
		},
		"blueprint:depletion-self": {
			...blueprintItem({
				id: "blueprint:depletion-self",
				lineId: "line:blueprint:depletion-self",
				outcome: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			units: {
				amount: 1,
				outcome: blueprintOutput("blueprint:depletion-self"),
			},
		},
		"blueprint:depletion-random": {
			...blueprintItem({
				id: "blueprint:depletion-random",
				lineId: "line:blueprint:depletion-random",
				outcome: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			units: {
				amount: 1,
				outcome: {
					set: [
						...blueprintOutput("item:target-unlimited").set,
						...blueprintOutput("item:depletion-product").set,
					],
				},
			},
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

			title: "Limited producer",
			description: "Produces one singleton outcome.",
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
					outcome: guaranteedOutput([
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
					outcome: blueprintOutput("blueprint:plain"),
					rules: [],
				},
			],
		},
		"producer:shared-source": {
			uid: "producer:shared-source",

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
					outcome: blueprintOutput("item:shared"),
					rules: [],
				},
			],
		},
		"producer:shared-consumer": {
			uid: "producer:shared-consumer",

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
									itemUid: "item:shared",
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
} satisfies z.input<typeof GameConfigSchema>);
