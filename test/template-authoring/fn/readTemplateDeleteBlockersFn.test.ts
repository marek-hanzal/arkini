import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { expect, it } from "vitest";
import { readTemplateDeleteBlockersFn } from "~/template-authoring/fn/readTemplateDeleteBlockersFn";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	createLine,
	createExpiryLine,
	createProducerItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

it("blocks deleting a generated-room template referenced by every outcome owner and receiver transport", () => {
	const space = {
		type: "inventory",
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
					createExpiryLine(outcome, "line:A-expiry"),
					createExpiryLine(outcome, "line:A-depletion"),
				],
				clock: {
					durationMs: 1000,
				},
				units: {
					amount: 1,
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
				"lines",
				1,
				"outcome",
				...tail,
			],
			[
				"items",
				"A",
				"lines",
				2,
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
