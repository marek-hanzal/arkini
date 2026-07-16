import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import { ProducerItemSchema } from "~/engine/item/schema/ProducerItemSchema";
import { SimpleItemSchema } from "~/engine/item/schema/SimpleItemSchema";
import { LineSchema } from "~/engine/line/schema/LineSchema";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import type { StartSchema } from "~/engine/start/schema/StartSchema";

export const createSimpleItem = (id: string, tags: string[] = []) =>
	SimpleItemSchema.parse({
		id,
		title: id,
		description: id,
		asset: {
			source: [
				`asset:${id}`,
			],
		},
		tags,
		categoryId: "category:test",
		scope: "any",
		maxStackSize: 10,
		type: "simple",
	});

export const createLine = ({
	id = "line:test",
	input = [
		{
			type: "simple",
		},
	],
	output,
}: {
	id?: string;
	input?: ReadonlyArray<InputSchema.Type>;
	output?: OutputSchema.Type;
}) =>
	LineSchema.parse({
		id,
		title: id,
		description: id,
		runtimeMs: 0,
		input,
		output,
		rules: [],
	});

export const createProducerItem = ({
	id,
	input,
	output,
	lines,
}: {
	id: string;
	input?: ReadonlyArray<InputSchema.Type>;
	output?: OutputSchema.Type;
	lines?: ReadonlyArray<LineSchema.Type>;
}) =>
	ProducerItemSchema.parse({
		...createSimpleItem(id),
		type: "producer",
		lines: lines ?? [
			createLine({
				input,
				output,
			}),
		],
	});

export const createOutput = (
	drops: ReadonlyArray<{
		itemId: string;
		placement?: "drop" | "random";
	}>,
) =>
	OutputSchema.parse({
		set: [
			{
				roll: [
					{
						type: "guaranteed",
						drop: drops.map(({ itemId, placement = "drop" }) => ({
							itemId,
							quantity: {
								type: "value",
								value: 1,
							},
							placement,
							rules: [],
						})),
					},
				],
			},
		],
	});

export const createRootSource = ({
	path = "/game/game.json",
	items = {},
	start = {
		currentSpace: 0,
		board: [],
		inventory: [],
	},
}: {
	path?: string;
	items?: Record<string, unknown>;
	start?: StartSchema.Type;
} = {}) =>
	GameSourceFileSchema.parse({
		path,
		value: {
			$schema: "../schema.json",
			version: "1.0",
			resources: {
				hero: "hero",
			},
			meta: {
				id: "game:test",
				title: "Test",
				board: {
					width: 3,
					height: 3,
				},
				inventory: {
					width: 3,
					height: 3,
				},
			},
			start,
			categories: {
				"category:test": {
					id: "category:test",
					title: "Test",
				},
			},
			items,
		},
	});
