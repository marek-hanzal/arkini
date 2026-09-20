import { describe, expect, it } from "vitest";

import { projectAuthoredOutputFn } from "~/production-output/fn/projectAuthoredOutputFn";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

describe("projectAuthoredOutputFn", () => {
	it("keeps set eligibility separate from item rules and grouped chance output", () => {
		const output = OutputSchema.parse({
			set: [
				{
					weight: 2,
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: {
										scope: "any",
										selector: {
											type: "item",
											itemId: "item:key",
										},
									},
								},
							],
						},
					],
					roll: [
						{
							type: "guaranteed",
							drop: [
								{
									itemId: "item:known",
									quantity: {
										min: 1,
										max: 1,
									},
									rules: [],
								},
							],
						},
						{
							type: "chance",
							chance: 0.25,
							drop: [
								{
									itemId: "item:missing",
									placement: "random",
									quantity: {
										min: 2,
										max: 4,
									},
									rules: [
										{
											type: "disable",
											when: [
												{
													type: "exists",
													query: {
														scope: "universe",
														selector: {
															type: "item",
															itemId: "item:missing",
														},
													},
												},
											],
										},
									],
								},
								{
									itemId: "item:known",
									quantity: {
										min: 1,
										max: 1,
									},
									rules: [],
								},
							],
						},
					],
				},
			],
		});
		const result = projectAuthoredOutputFn(output, {
			"item:known": {
				title: "Known item",
			},
		});
		expect(result).toMatchObject([
			{
				weight: 2,
				rules: output.set[0].rules,
				activeRuleHints: [],
				roll: [
					{
						kind: "guaranteed",
						item: [
							{
								itemId: "item:known",
								title: "Known item",
								rules: [],
							},
						],
					},
					{
						kind: "chance",
						chance: 0.25,
						item: [
							{
								itemId: "item:missing",
								title: "item:missing",
								placement: "random",
								quantity: {
									min: 2,
									max: 4,
								},
								rules: output.set[0].roll[1].drop[0].rules,
							},
							{
								itemId: "item:known",
								title: "Known item",
							},
						],
					},
				],
			},
		]);
	});
});
