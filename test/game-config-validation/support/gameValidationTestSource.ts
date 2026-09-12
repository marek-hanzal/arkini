import { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";

export const createItemBase = (id: string) => ({
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
	scope: "any",
	maxStackSize: 10,
});

export const createSimpleItem = (id: string) =>
	ItemSchema.parse({
		...createItemBase(id),
	});

export const createLine = ({
	default: isDefault = false,
	clock,
	id = "line:test",
	input = [
		{
			type: "simple",
		},
	],
	output,
}: {
	default?: boolean;
	clock?: boolean;
	id?: string;
	input?: ReadonlyArray<InputSchema.Type>;
	output?: OutputSchema.Type;
}) =>
	LineSchema.parse({
		id,
		title: id,
		description: id,
		default: isDefault,
		clock,
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
	ItemSchema.parse({
		...createSimpleItem(id),

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
			$schema: "schema.json",
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
