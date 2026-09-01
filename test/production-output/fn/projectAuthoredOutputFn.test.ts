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
									drop: [
										drop("item:known"),
									],
									weight: 3,
								},
								{
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
								item: [
									{
										activeRuleHints: [],
										...drop("item:known"),
										title: "Known item",
									},
								],
								weight: 3,
							},
							{
								item: [
									{
										activeRuleHints: [],
										...drop("item:missing"),
										title: "item:missing",
									},
								],
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
