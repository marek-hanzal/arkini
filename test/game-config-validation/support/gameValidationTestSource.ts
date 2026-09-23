import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";

export const createItemBase = (id: string) => ({
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

export const createSimpleItem = (id: string) =>
	ItemSchema.parse({
		...createItemBase(id),
		ui: "simple",
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
	outcome,
}: {
	default?: boolean;
	clock?: boolean;
	id?: string;
	input?: ReadonlyArray<InputSchema.Type>;
	outcome?: OutcomeTableSchema.Type;
}) =>
	LineSchema.parse({
		id,
		title: id,
		description: id,
		default: isDefault,
		clock,
		runtimeMs: 0,
		input,
		outcome,
		rules: [],
	});

export const createProducerItem = ({
	id,
	input,
	outcome,
	lines,
}: {
	id: string;
	input?: ReadonlyArray<InputSchema.Type>;
	outcome?: OutcomeTableSchema.Type;
	lines?: ReadonlyArray<LineSchema.Type>;
}) =>
	ItemSchema.parse({
		...createSimpleItem(id),
		ui: "default",

		lines: lines ?? [
			createLine({
				input,
				outcome,
			}),
		],
	});

export const createOutput = (
	drops: ReadonlyArray<{
		itemId: string;
		placement?: "drop" | "random";
	}>,
) =>
	OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: drops.map(({ itemId, placement = "drop" }) => ({
							type: "item",
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
	templates = [
		{
			uid: "initial",
			title: "Initial",
			width: 3,
			height: 3,
			board: [],
		},
	],
	start = {
		currentSpace: 0,
		spaces: [
			{
				space: 0,
				templateUid: "initial",
			},
		],
	},
}: {
	path?: string;
	items?: Record<string, unknown>;
	start?: StartSchema.Type;
	templates?: TemplateSchema.Type[];
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
			},
			start,
			templates,
			items,
		},
	});
