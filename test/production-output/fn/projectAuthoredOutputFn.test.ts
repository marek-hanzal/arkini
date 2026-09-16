import { describe, expect, it } from "vitest";

import { projectAuthoredOutputFn } from "~/production-output/fn/projectAuthoredOutputFn";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";

const drop = (itemId: string) => ({
	itemId,
	placement: "drop" as const,
	quantity: {
		max: 1,
		min: 1,
	},
	rules: [],
});

describe("projectAuthoredOutputFn", () => {
	it("preserves every roll alternative and authored drop metadata for shared presentation", () => {
		const output: OutputSchema.Type = {
			set: [
				{
					roll: [
						{
							drop: [
								drop("item:known"),
							],
							type: "guaranteed",
						},
						{
							chance: 0.25,
							drop: [
								drop("item:missing"),
							],
							type: "chance",
						},
						{
							drop: [
								{
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
															itemId: "item:known",
														},
													},
												},
											],
										},
									],
									drop: [
										drop("item:known"),
									],
									weight: 3,
								},
								{
									rules: [],
									drop: [
										drop("item:missing"),
									],
									weight: 1,
								},
							],
							quantity: {
								max: 2,
								min: 1,
							},
							type: "weight",
						},
					],
					weight: 2,
				},
			],
		};

		expect(
			projectAuthoredOutputFn(output, {
				"item:known": {
					title: "Known item",
				},
			}),
		).toEqual([
			{
				roll: [
					{
						item: [
							{
								activeRuleHints: [],
								...drop("item:known"),
								title: "Known item",
							},
						],
						kind: "guaranteed",
					},
					{
						chance: 0.25,
						item: [
							{
								activeRuleHints: [],
								...drop("item:missing"),
								title: "item:missing",
							},
						],
						kind: "chance",
					},
					{
						kind: "weight",
						option: [
							{
								activeRuleHints: [],
								item: [
									{
										activeRuleHints: [],
										...drop("item:known"),
										title: "Known item",
									},
								],
								rules:
									output.set[0].roll[2].type === "weight"
										? output.set[0].roll[2].drop[0].rules
										: [],
								weight: 3,
							},
							{
								activeRuleHints: [],
								item: [
									{
										activeRuleHints: [],
										...drop("item:missing"),
										title: "item:missing",
									},
								],
								rules: [],
								weight: 1,
							},
						],
						selections: {
							max: 2,
							min: 1,
						},
					},
				],
				weight: 2,
			},
		]);
	});
});
