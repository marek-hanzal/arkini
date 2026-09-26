import { describe, expect, it } from "vitest";

import { projectAuthoredOutcomeFn } from "~/outcome/fn/projectAuthoredOutcomeFn";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

describe("projectAuthoredOutcomeFn", () => {
	it("keeps set eligibility separate from item rules and grouped chance table", () => {
		const table = OutcomeTableSchema.parse({
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
										distance: "far" as const,
										selector: {
											type: "item",
											itemUid: "item:key",
										},
									},
								},
							],
						},
					],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "item",
									itemUid: "item:known",
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
							outcome: [
								{
									type: "item",
									itemUid: "item:missing",
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
														distance: "far" as const,
														selector: {
															type: "item",
															itemUid: "item:missing",
														},
													},
												},
											],
										},
									],
								},
								{
									type: "item",
									itemUid: "item:known",
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
		const result = projectAuthoredOutcomeFn(table, {
			"item:known": {
				title: "Known item",
			},
		});
		expect(result).toMatchObject([
			{
				weight: 2,
				rules: table.set[0].rules,
				activeRuleHints: [],
				roll: [
					{
						kind: "guaranteed",
						outcome: [
							{
								itemUid: "item:known",
								title: "Known item",
								rules: [],
							},
						],
					},
					{
						kind: "chance",
						chance: 0.25,
						outcome: [
							{
								type: "item",
								itemUid: "item:missing",
								title: "item:missing",
								placement: "random",
								quantity: {
									min: 2,
									max: 4,
								},
								rules: table.set[0].roll[1].outcome[0].rules,
							},
							{
								itemUid: "item:known",
								title: "Known item",
							},
						],
					},
				],
			},
		]);
	});
});

it("preserves mixed outcome ordering and Space-only sets in the authored projection", () => {
	const result = projectAuthoredOutcomeFn(
		OutcomeTableSchema.parse({
			set: [
				{
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "space",
									space: 4,
									rules: [],
								},
								{
									type: "item",
									itemUid: "reward",
									quantity: {
										min: 1,
										max: 2,
									},
									rules: [],
								},
								{
									type: "space",
									space: 9,
									rules: [],
								},
								{
									type: "template",
									templateUid: "target-template",
									space: 12,
									rules: [],
								},
							],
						},
					],
				},
				{
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "space",
									space: 2,
									rules: [],
								},
							],
						},
					],
				},
			],
		}),
		{
			reward: {
				title: "Reward",
			},
		},
	);
	expect(result[0]?.roll[0]?.outcome.map((entry) => entry.type)).toEqual([
		"space",
		"item",
		"space",
		"template",
	]);
	expect(result[0]?.roll[0]?.outcome[1]).toMatchObject({
		type: "item",
		title: "Reward",
		quantity: {
			min: 1,
			max: 2,
		},
	});
	expect(result[0]?.roll[0]?.outcome[3]).toMatchObject({
		type: "template",
		templateUid: "target-template",
		space: 12,
	});
	expect(result[1]?.roll[0]?.outcome).toEqual([
		{
			type: "space",
			space: 2,
			rules: [],
			activeRuleHints: [],
		},
	]);
});
