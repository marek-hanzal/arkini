import { expect, it } from "vitest";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

it("does not claim a complete acquisition through destructive template replacement", () => {
	const outcome = OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "item",
								rules: [],
								itemId: "reward",
								quantity: {
									min: 1,
									max: 1,
								},
							},
							{
								type: "template",
								rules: [],
								templateUid: "initial",
							},
						],
					},
				],
			},
		],
	});
	const graph = createAcquisitionGraphFn({
		...editorTestConfig,
		items: {
			water: createProducerItem({
				id: "water",
				outcome,
			}),
			reward: createSimpleItem("reward"),
		},
	});
	const [reward, water] = estimateRequestsFn({
		graph,
		requests: [
			{
				factId: "reward",
			},
			{
				factId: "water",
			},
		],
	});
	expect(reward).toMatchObject({
		status: "partial",
		obtainable: false,
		limitations: expect.arrayContaining([
			"template-resets-not-simulated",
		]),
		diagnostics: expect.arrayContaining([
			expect.objectContaining({
				kind: "template-reset-unsupported",
			}),
		]),
	});
	expect(water).toMatchObject({
		status: "complete",
		obtainable: true,
	});
});
