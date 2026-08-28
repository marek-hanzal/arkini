import { Effect } from "effect";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import {
	createLine,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const createRuledOutput = (type: "disable" | "enable") =>
	OutputSchema.parse({
		set: [
			{
				roll: [
					{
						drop: [
							{
								itemId: `item:${type}`,
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
													scope: "universe",
													selector: {
														itemId: "item:condition",
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
								output: createRuledOutput("enable"),
							}),
							createLine({
								id: "line:disable",
								output: createRuledOutput("disable"),
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
