import { Effect } from "effect";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import {
	createLine,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const createRuledOutput = (type: "disable" | "enable") =>
	OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						outcome: [
							{
								type: "item",
								itemUid: `item:${type}`,
								quantity: {
									max: 1,
									min: 1,
								},
								rules: [
									{
										type,
										when: [
											{
												query: {
													distance: "far",
													selector: {
														itemUid: "item:condition",
														type: "item",
													},
												},
												type: "exists",
											},
										],
									},
								],
							},
						],
						type: "guaranteed",
					},
				],
			},
		],
	});

export const createMultiOutputLimitationConfigFx = Effect.fn("createMultiOutputLimitationConfigFx")(
	function* () {
		const result = yield* compileGameSourcesFx([
			createRootSource({
				items: {
					"item:condition": createSimpleItem("item:condition"),
					"item:disable": createSimpleItem("item:disable"),
					"item:enable": createSimpleItem("item:enable"),
					producer: createProducerItem({
						id: "producer",
						lines: [
							createLine({
								id: "line:enable",
								outcome: createRuledOutput("enable"),
							}),
							createLine({
								id: "line:disable",
								outcome: createRuledOutput("disable"),
							}),
						],
					}),
				},
			}),
		]);
		if (result.config === undefined) return yield* Effect.die("Expected compiled test config.");
		return result.config;
	},
);
