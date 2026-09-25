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
	clock,
	uid = "line:test",
	input = [
		{
			type: "simple",
		},
	],
	outcome,
}: {
	default?: boolean;
	clock?: LineSchema.Type["clock"];
	uid?: string;
	input?: ReadonlyArray<InputSchema.Type>;
	outcome?: OutcomeTableSchema.Type;
}) =>
	LineSchema.parse({
		uid,
		title: uid,
		description: uid,
		default: isDefault,
		clock,
		runtimeMs: 0,
		input,
		outcome,
		rules: [],
	});

export const createExpiryLine = (outcome: OutcomeTableSchema.Type, uid = "line:expiry") =>
	createLine({
		uid,
		clock: "clock-lifetime",
		input: [],
		outcome,
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
