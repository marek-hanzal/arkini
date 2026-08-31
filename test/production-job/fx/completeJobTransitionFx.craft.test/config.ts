import type { z } from "zod";

import { CraftSchema } from "~/item-definition/schema/CraftSchema";
import { SimpleSchema } from "~/item-definition/schema/SimpleSchema";
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
	maxStackSize = 1,
	output,
}: {
	readonly id: string;
	readonly inputItemId?: string;
	readonly maxStackSize?: number;
	readonly output?: OutputInput;
}) =>
	({
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		charges: {
			amount: 1,
		},
		description: id,
		id,
		line: {
			description: `line:${id}`,
			id: `line:${id}`,
			input:
				inputItemId === undefined
					? [
							{
								charges: {
									cost: 1,
									from: "self",
								},
								type: "simple",
							},
						]
					: [
							{
								charges: {
									cost: 1,
									from: "self",
								},
								mode: "reserve",
								quantity: {
									max: 1,
									min: 1,
								},
								selector: {
									itemId: inputItemId,
									type: "item",
								},
								type: "materials",
							},
						],
			output,
			rules: [],
			runtimeMs: 200,
			title: `line:${id}`,
		},
		maxStackSize,
		scope: "any",
		title: id,
		type: "craft",
		uid: id,
	}) satisfies z.input<typeof CraftSchema>;

const simpleItem = (id: string, scope: "any" | "board" = "any") =>
	({
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		description: id,
		id,
		maxStackSize: 1,
		scope,
		title: id,
		type: "simple",
		uid: id,
	}) satisfies z.input<typeof SimpleSchema>;

/** One canonical parse owns every compact authored fixture builder above. */
export const craftCompletionConfig = GameConfigSchema.parse({
	items: {
		"craft:drop": craftItem({
			id: "craft:drop",
			maxStackSize: 3,
			output: guaranteedOutput("item:product"),
		}),
		"craft:ordered-output": craftItem({
			id: "craft:ordered-output",
			maxStackSize: 3,
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
		"item:bonus": simpleItem("item:bonus", "board"),
		"item:product": simpleItem("item:product"),
		"item:random-a": simpleItem("item:random-a"),
		"item:random-b": simpleItem("item:random-b"),
		"item:result": simpleItem("item:result", "board"),
		"item:tool": simpleItem("item:tool"),
	},
	meta: {
		board: {
			height: 2,
			width: 3,
		},
		id: "game:craft-completion",
		inventory: {
			height: 1,
			width: 1,
		},
		title: "Craft completion",
	},
	resources: {
		hero: "hero",
	},
	start: {
		currentSpace: 0,
	},
} satisfies z.input<typeof GameConfigSchema>);
