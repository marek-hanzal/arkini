import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { expect, it } from "vitest";
import { readTemplateDeleteBlockersFn } from "~/template-authoring/fn/readTemplateDeleteBlockersFn";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	createLine,
	createProducerItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

it("blocks deleting a generated-room template referenced by every outcome owner and receiver transport", () => {
	const space = {
		type: "generated",
		templateUid: "interior",
	};
	const outcome = OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "space",
								space,
								rules: [],
							},
						],
					},
				],
			},
		],
	});
	const config = GameConfigSchema.parse({
		...editorTestConfig,
		items: {
			A: {
				...createProducerItem({
					id: "A",
				}),
				lines: [
					createLine({
						outcome,
					}),
				],
				clock: {
					durationMs: 1000,
					onExpire: outcome,
				},
				units: {
					amount: 1,
					outcome,
				},
				merge: [
					{
						action: "space",
						space,
						effect: "keep",
						outcome,
					},
				],
			},
		},
		templates: [
			{
				uid: "interior",
				title: "Interior",
				width: 1,
				height: 1,
				board: [],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [],
		},
	});
	const blockers = readTemplateDeleteBlockersFn(config, "interior");
	const tail = [
		"set",
		0,
		"roll",
		0,
		"outcome",
		0,
		"space",
		"templateUid",
	];
	expect(blockers.map(({ path }) => path)).toEqual(
		expect.arrayContaining([
			[
				"items",
				"A",
				"lines",
				0,
				"outcome",
				...tail,
			],
			[
				"items",
				"A",
				"clock",
				"onExpire",
				...tail,
			],
			[
				"items",
				"A",
				"units",
				"outcome",
				...tail,
			],
			[
				"items",
				"A",
				"merge",
				0,
				"outcome",
				...tail,
			],
			[
				"items",
				"A",
				"merge",
				0,
				"space",
				"templateUid",
			],
		]),
	);
	expect(blockers).toHaveLength(5);
});
