import { describe, expect, it } from "vitest";

import { readAcquisitionOutputOccurrencesFn } from "~/flow/fn/readAcquisitionOutputOccurrencesFn";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

const readFn = (input: unknown) =>
	readAcquisitionOutputOccurrencesFn(OutcomeTableSchema.parse(input));

describe("readAcquisitionOutputOccurrencesFn", () => {
	it("keeps weighted selection and authored range probability mass", () => {
		const result = readFn({
			set: [
				{
					weight: 1,
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "item",
									itemUid: "a",
									quantity: {
										min: 1,
										max: 2,
									},
									rules: [],
								},
							],
						},
					],
				},
				{
					weight: 1,
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "item",
									itemUid: "b",
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

		expect(result.compilation).toBe("complete");
		expect(
			result.occurrences.find(({ factId }) => factId === "a")?.quantityDistribution,
		).toEqual([
			{
				probability: 0.5,
				quantity: 0,
			},
			{
				probability: 0.25,
				quantity: 1,
			},
			{
				probability: 0.25,
				quantity: 2,
			},
		]);
	});

	it("preserves correlated co-outputs and convolves repeated same-fact drops", () => {
		const result = readFn({
			set: [
				{
					rules: [],
					roll: [
						{
							outcome: [
								{
									type: "item",
									itemUid: "a",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							type: "guaranteed",
						},
						{
							chance: 0.5,
							outcome: [
								{
									type: "item",
									itemUid: "a",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
								{
									type: "item",
									itemUid: "b",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
							],
							type: "chance",
						},
					],
					weight: 1,
				},
			],
		});
		const a = result.occurrences.filter(({ factId }) => factId === "a");

		expect(a[0]?.occurrenceQuantityDistribution).toEqual([
			{
				probability: 1,
				quantity: 1,
			},
		]);
		expect(a[1]?.occurrenceQuantityDistribution).toEqual([
			{
				probability: 0.5,
				quantity: 0,
			},
			{
				probability: 0.5,
				quantity: 1,
			},
		]);
		expect(a[0]?.quantityDistribution).toEqual([
			{
				probability: 0.5,
				quantity: 1,
			},
			{
				probability: 0.5,
				quantity: 2,
			},
		]);
		expect(a[1]?.quantityDistribution).toEqual(a[0]?.quantityDistribution);
		expect(result.outputDistribution).toHaveLength(2);
		expect(
			result.outputDistribution.find(({ quantities }) => quantities.length === 2),
		).toMatchObject({
			probability: 0.5,
			quantities: expect.arrayContaining([
				expect.objectContaining({
					quantity: 2,
				}),
				expect.objectContaining({
					quantity: 1,
				}),
			]),
		});
	});

	it("keeps set requirements while refusing a false static weight distribution", () => {
		const result = readFn({
			set: [
				{
					weight: 1,
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemUid: "permit",
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
									itemUid: "a",
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
				{
					weight: 1,
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "item",
									itemUid: "b",
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

		expect(result.compilation).toBe("state-space-unsupported");
		expect(result.outputDistribution).toEqual([]);
		expect(result.occurrences.find(({ factId }) => factId === "a")?.requirements).toMatchObject(
			{
				allOf: [
					expect.objectContaining({
						factId: "permit",
					}),
				],
			},
		);
	});

	it("returns explicit overflow before authored output expansion becomes unbounded", () => {
		const chanceRollFn = (index: number) => ({
			chance: 0.5,
			outcome: [
				{
					type: "item",
					itemUid: `item:${index}`,
					quantity: {
						max: 1,
						min: 1,
					},
					rules: [],
				},
			],
			type: "chance" as const,
		});
		const result = readFn({
			set: [
				{
					rules: [],
					roll: Array.from(
						{
							length: 14,
						},
						(_, index) => chanceRollFn(index),
					),
					weight: 1,
				},
			],
		});

		expect(result).toMatchObject({
			compilation: "state-space-unsupported",
			occurrences: {
				length: 14,
			},
			outputDistribution: [],
		});
		expect(
			readFn({
				set: [
					{
						rules: [],
						roll: [
							{
								outcome: [
									{
										type: "item",
										itemUid: "huge",
										quantity: {
											max: 4_294_967_296,
											min: 1,
										},
										rules: [],
									},
								],
								type: "guaranteed",
							},
						],
						weight: 1,
					},
				],
			}).compilation,
		).toBe("state-space-unsupported");
	});
});

it("keeps Space-only alternatives in item probability mass without creating acquisition facts", () => {
	const result = readFn({
		set: [
			{
				weight: 1,
				rules: [],
				roll: [
					{
						type: "guaranteed",
						outcome: [
							{
								type: "space",
								space: 7,
								rules: [],
							},
						],
					},
				],
			},
			{
				weight: 1,
				rules: [],
				roll: [
					{
						type: "chance",
						chance: 0.5,
						outcome: [
							{
								type: "space",
								space: 9,
								rules: [],
							},
							{
								type: "item",
								itemUid: "reward",
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
	expect(result.compilation).toBe("complete");
	expect(result.occurrences.map(({ factId }) => factId)).toEqual([
		"reward",
	]);
	expect(result.occurrences[0]?.quantityDistribution).toEqual([
		{
			probability: 0.75,
			quantity: 0,
		},
		{
			probability: 0.25,
			quantity: 1,
		},
	]);
});
