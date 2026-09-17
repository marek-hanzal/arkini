import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { renameFx } from "~/item-authoring/fx/renameFx";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { validateConfigReferencesFn } from "~/game-config-validation/fn/validateConfigReferencesFn";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createLine,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const rules = [
	{
		type: "disable",
		when: [
			{
				type: "limit",
				itemId: "water",
			},
		],
	},
];
const makeConfig = () =>
	GameConfigSchema.parse({
		...editorTestConfig,
		start: {
			...editorTestConfig.start,
			board: [],
		},
		items: {
			water: editorTestConfig.items.water,
			result: createSimpleItem("result"),
			producer: {
				...createSimpleItem("producer"),
				lines: [
					{
						...createLine({
							id: "line-limit",
						}),
						rules,
					},
					{
						...createLine({
							id: "drop-limit",
						}),
						output: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "result",
													quantity: {
														min: 1,
														max: 1,
													},
													rules,
												},
											],
										},
									],
								},
							],
						},
					},
					createLine({
						id: "unrelated",
					}),
				],
			},
		},
	});
const paths = [
	[
		"items",
		"producer",
		"lines",
		0,
		"rules",
		0,
		"when",
		0,
		"itemId",
	],
	[
		"items",
		"producer",
		"lines",
		1,
		"output",
		"set",
		0,
		"roll",
		0,
		"drop",
		0,
		"rules",
		0,
		"when",
		0,
		"itemId",
	],
];

describe("Limit reference integrity", () => {
	it("renames canonical targets in line and drop rules without touching output identities", () => {
		const config = makeConfig();
		const renamed = Effect.runSync(
			renameFx({
				config,
				itemId: "water",
				newItemId: "fresh-water",
			}),
		);
		expect(renamed.updatedReferencePaths).toEqual(paths);
		expect(JSON.stringify(renamed.config.items.producer)).not.toContain('"water"');
		expect(
			renamed.config.items.producer?.lines[1]?.output?.set[0]?.roll[0]?.drop[0],
		).toMatchObject({
			itemId: "result",
		});
		expect(
			validateConfigReferencesFn({
				config: renamed.config,
				provenance: {
					items: {},
				},
			}),
		).toEqual([]);
		expect(config.items.producer?.lines[0]?.rules[0]?.when[0]).toEqual({
			type: "limit",
			itemId: "water",
		});
	});

	it("blocks target deletion and force deletion removes only the referencing structures", () => {
		const config = makeConfig();
		expect(
			readDeleteBlockersFn({
				config,
				itemId: "water",
			}).map(({ path }) => path),
		).toEqual(paths);
		const removed = Effect.runSync(
			forceDeleteFx({
				config,
				itemId: "water",
			}),
		);
		expect(removed.config.items.water).toBeUndefined();
		expect(removed.config.items.producer?.lines.map(({ id }) => id)).toEqual([
			"unrelated",
		]);
		expect(
			validateConfigReferencesFn({
				config: removed.config,
				provenance: {
					items: {},
				},
			}),
		).toEqual([]);
	});
});
