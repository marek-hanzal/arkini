import { describe, expect, it } from "vitest";

import { readAcquisitionOutputOccurrencesFn } from "~/flow/fn/readAcquisitionOutputOccurrencesFn";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

const readFn = (input: unknown) => readAcquisitionOutputOccurrencesFn(OutputSchema.parse(input));

describe("readAcquisitionOutputOccurrencesFn", () => {
	it("keeps weighted selection and authored range probability mass", () => {
		const result = readFn({
			set: [
				{
					roll: [
						{
							drop: [
								{
									drop: [
										{
											itemId: "a",
											quantity: {
												max: 2,
												min: 1,
											},
											rules: [],
										},
									],
									weight: 1,
								},
								{
									drop: [
										{
											itemId: "b",
											quantity: {
												max: 1,
												min: 1,
											},
											rules: [],
										},
									],
									weight: 1,
								},
							],
							quantity: {
								max: 1,
								min: 1,
							},
							type: "weight",
						},
					],
					weight: 1,
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
					roll: [
						{
							drop: [
								{
									itemId: "a",
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
							drop: [
								{
									itemId: "a",
									quantity: {
										max: 1,
										min: 1,
									},
									rules: [],
								},
								{
									itemId: "b",
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

	it("returns explicit overflow before authored output expansion becomes unbounded", () => {
		const chanceRollFn = (index: number) => ({
			chance: 0.5,
			drop: [
				{
					itemId: `item:${index}`,
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
						roll: [
							{
								drop: [
									{
										itemId: "huge",
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
