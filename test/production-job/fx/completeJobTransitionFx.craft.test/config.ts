import type { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

type OutputInput = z.input<typeof OutcomeTableSchema>;

const fixedDrop = (itemId: string, quantity = 1) => ({
	type: "item" as const,
	itemId,
	placement: "drop" as const,
	quantity: {
		max: quantity,
		min: quantity,
	},
	rules: [],
});

const guaranteedOutput = (...itemIds: ReadonlyArray<string>): OutputInput =>
	OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						outcome: itemIds.map((itemId) => fixedDrop(itemId)),
						type: "guaranteed",
					},
				],
			},
		],
	});

const randomOutput = (...itemIds: ReadonlyArray<string>): OutputInput =>
	OutcomeTableSchema.parse({
		set: itemIds.map((itemId) => ({
			rules: [],
			roll: [
				{
					outcome: [
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
	outcome,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly outcome?: OutputInput;
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
				outcome,
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

			outcome: guaranteedOutput("item:product"),
		}),
		"craft:ordered-outcome": craftItem({
			id: "craft:ordered-outcome",

			outcome: guaranteedOutput("item:bonus", "item:result"),
		}),
		"craft:random": craftItem({
			id: "craft:random",
			outcome: randomOutput("item:random-a", "item:random-b"),
		}),
		"craft:reserve": craftItem({
			id: "craft:reserve",
			inputItemId: "item:tool",
			outcome: guaranteedOutput("item:product"),
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
