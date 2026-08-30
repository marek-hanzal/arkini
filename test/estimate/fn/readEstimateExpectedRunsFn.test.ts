import { describe, expect, it } from "vitest";

import {
	readEstimateExpectedRunsFn,
	readEstimateScalarExpectedRunsFn,
} from "~/estimate/fn/readEstimateExpectedRunsFn";

const exclusiveDistribution = [
	{
		probability: 0.5,
		quantities: [
			{
				outputGroupId: "a",
				quantity: 1,
			},
		],
	},
	{
		probability: 0.5,
		quantities: [
			{
				outputGroupId: "b",
				quantity: 1,
			},
		],
	},
] as const;

describe("readEstimateExpectedRunsFn", () => {
	it("keeps deterministic outputs in whole authored-operation batches", () => {
		expect(
			readEstimateScalarExpectedRunsFn(
				[
					{
						probability: 1,
						quantity: 2,
					},
				],
				5,
			),
		).toEqual({
			runs: 3,
			status: "complete",
		});
	});

	it("keeps deterministic joint outputs in atomic operation batches", () => {
		const readFn = (demand: number) =>
			readEstimateExpectedRunsFn({
				distribution: [
					{
						probability: 1,
						quantities: [
							{
								outputGroupId: "a",
								quantity: 1,
							},
							{
								outputGroupId: "b",
								quantity: 1,
							},
						],
					},
				],
				demandByOutputGroupId: new Map([
					[
						"a",
						demand,
					],
					[
						"b",
						demand,
					],
				]),
			});

		expect(readFn(0.5)).toEqual({
			runs: 1,
			status: "complete",
		});
		expect(readFn(1.5)).toEqual({
			runs: 2,
			status: "complete",
		});
	});

	it("uses the correlated outcome vector when both stochastic co-products are required", () => {
		expect(
			readEstimateExpectedRunsFn({
				distribution: exclusiveDistribution,
				demandByOutputGroupId: new Map([
					[
						"a",
						1,
					],
					[
						"b",
						1,
					],
				]),
			}),
		).toEqual({
			runs: 3,
			status: "complete",
		});
	});

	it("interpolates fractional joint demands from surrounding integer states", () => {
		expect(
			readEstimateExpectedRunsFn({
				distribution: exclusiveDistribution,
				demandByOutputGroupId: new Map([
					[
						"a",
						0.5,
					],
					[
						"b",
						0.5,
					],
				]),
			}),
		).toEqual({
			runs: 1.75,
			status: "complete",
		});
	});

	it("does not apply the stochastic state bound to deterministic batches", () => {
		expect(
			readEstimateExpectedRunsFn({
				distribution: [
					{
						probability: 1,
						quantities: [
							{
								outputGroupId: "a",
								quantity: 1,
							},
							{
								outputGroupId: "b",
								quantity: 1,
							},
						],
					},
				],
				demandByOutputGroupId: new Map([
					[
						"a",
						100,
					],
					[
						"b",
						100,
					],
				]),
			}),
		).toEqual({
			runs: 100,
			status: "complete",
		});
	});
});
