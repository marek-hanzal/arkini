import type { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

type OutputInput = z.input<typeof OutputSchema>;

const fixedDrop = (itemId: string, quantity = 1) => ({
	itemId,
	placement: "drop" as const,
	quantity: {
		max: quantity,
		min: quantity,
	},
	rules: [],
});

const guaranteedOutput = (...itemIds: ReadonlyArray<string>): OutputInput =>
	OutputSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						drop: itemIds.map((itemId) => fixedDrop(itemId)),
						type: "guaranteed",
					},
				],
			},
		],
	});

const randomOutput = (...itemIds: ReadonlyArray<string>): OutputInput =>
	OutputSchema.parse({
		set: itemIds.map((itemId) => ({
			rules: [],
			roll: [
				{
					drop: [
						fixedDrop(itemId, 2),
					],
					type: "guaranteed" as const,
				},
			],
			weight: 1,
		})),
	});

const craftItem = ({
	id,
	inputItemId,
	output,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly output?: OutputInput;
}) =>
	({
		maxQueueSize: 1,

		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},
		units: {
			amount: 1,
		},
		description: id,
		id,
		ui: "default",
		lines: [
			{
				description: `line:${id}`,
				id: `line:${id}`,
				input:
					inputItemId === undefined
						? [
								{
									units: {
										cost: 1,
										from: "self",
									},
									type: "simple",
								},
							]
						: [
								{
									units: {
										cost: 1,
										from: "self",
									},
									mode: "reserve",
									quantity: {
										max: 1,
										min: 1,
									},
									query: {
										distance: "far" as const,
										selector: {
											itemId: inputItemId,
											type: "item",
										},
									},
									type: "materials",
								},
							],
				output,
				rules: [],
				runtimeMs: 200,
				title: `line:${id}`,
			},
		],

		title: id,

		uid: id,
	}) satisfies z.input<typeof ItemSchema>;

const simpleItem = (id: string) =>
	({
		maxQueueSize: 1,
		lines: [],

		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},
		description: id,
		id,
		ui: "simple",

		title: id,

		uid: id,
	}) satisfies z.input<typeof ItemSchema>;

/** One canonical parse owns every compact authored fixture builder above. */
export const craftCompletionConfig = GameConfigSchema.parse({
	items: {
		"craft:drop": craftItem({
			id: "craft:drop",

			output: guaranteedOutput("item:product"),
		}),
		"craft:ordered-output": craftItem({
			id: "craft:ordered-output",

			output: guaranteedOutput("item:bonus", "item:result"),
		}),
		"craft:random": craftItem({
			id: "craft:random",
			output: randomOutput("item:random-a", "item:random-b"),
		}),
		"craft:reserve": craftItem({
			id: "craft:reserve",
			inputItemId: "item:tool",
			output: guaranteedOutput("item:product"),
		}),
		"craft:sink": craftItem({
			id: "craft:sink",
		}),
		"item:blocker": simpleItem("item:blocker"),
		"item:bonus": simpleItem("item:bonus"),
		"item:product": simpleItem("item:product"),
		"item:random-a": simpleItem("item:random-a"),
		"item:random-b": simpleItem("item:random-b"),
		"item:result": simpleItem("item:result"),
		"item:tool": simpleItem("item:tool"),
	},
	meta: {
		board: {
			height: 2,
			width: 3,
		},
		id: "game:craft-completion",
		title: "Craft completion",
	},
	resources: {
		hero: "hero",
	},
	start: {
		currentSpace: 0,
	},
} satisfies z.input<typeof GameConfigSchema>);
