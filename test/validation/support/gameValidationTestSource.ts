import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import { ProducerSchema } from "~/engine/item/schema/ProducerSchema";
import { SimpleSchema } from "~/engine/item/schema/SimpleSchema";
import { LineSchema } from "~/engine/line/schema/LineSchema";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import type { StartSchema } from "~/engine/start/schema/StartSchema";

export const createSimpleItem = (id: string) =>
	SimpleSchema.parse({
		uid: id,
		id,
		title: id,
		description: id,
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		scope: "any",
		maxStackSize: 10,
		type: "simple",
	});

export const createLine = ({
	default: isDefault = false,
	id = "line:test",
	input = [
		{
			type: "simple",
		},
	],
	output,
}: {
	default?: boolean;
	id?: string;
	input?: ReadonlyArray<InputSchema.Type>;
	output?: OutputSchema.Type;
}) =>
	LineSchema.parse({
		id,
		title: id,
		description: id,
		default: isDefault,
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
	ProducerSchema.parse({
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
								min: 1,
								max: 1,
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
		toolbar: [],
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
			items,
		},
	});
