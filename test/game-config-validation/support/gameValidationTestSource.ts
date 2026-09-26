import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";

export const createItemBase = (id: string) => ({
	uid: id,
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
	trigger = "manual",
	uid = "line:test",
	input = [],
	outcome,
}: {
	default?: boolean;
	trigger?: LineSchema.Type["trigger"];
	uid?: string;
	input?: ReadonlyArray<InputSchema.Type>;
	outcome?: OutcomeTableSchema.Type;
}) =>
	LineSchema.parse({
		uid,
		title: uid,
		description: uid,
		default: isDefault,
		trigger,
		runtimeMs: 0,
		input,
		outcome,
		rules: [],
	});

export const createExpiryLine = (outcome: OutcomeTableSchema.Type, uid = "line:expiry") =>
	createLine({
		uid,
		trigger: "item-termination",
		input: [],
		outcome,
	});

export const createProducerItem = ({
	id,
	input,
	outcome,
	lines,
	clock,
}: {
	id: string;
	input?: ReadonlyArray<InputSchema.Type>;
	outcome?: OutcomeTableSchema.Type;
	lines?: ReadonlyArray<LineSchema.Type>;
	clock?: ItemSchema.Type["clock"];
}) =>
	ItemSchema.parse({
		...createSimpleItem(id),
		ui: "default",
		clock,

		lines: lines ?? [
			createLine({
				input,
				outcome,
			}),
		],
	});

export const createOutput = (
	drops: ReadonlyArray<{
		itemUid: string;
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
						outcome: drops.map(({ itemUid, placement = "drop" }) => ({
							type: "item",
							itemUid,
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
