import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readPlannerExpectedIndependentRunsFx } from "~/editor/planner/readPlannerExpectedIndependentRunsFx";

const readExpectedRuns = (props: Parameters<typeof readPlannerExpectedIndependentRunsFx>[0]) =>
	Effect.runSync(readPlannerExpectedIndependentRunsFx(props));

describe("readPlannerExpectedIndependentRunsFx", () => {
	it("counts deterministic runs including overshoot", () => {
		expect(
			readExpectedRuns({
				distribution: [
					{
						probability: 1,
						quantity: 2,
					},
				],
				quantity: 5,
			}),
		).toBe(3);
	});

	it("solves Bernoulli accumulation as a hitting time", () => {
		expect(
			readExpectedRuns({
				distribution: [
					{
						probability: 0.5,
						quantity: 0,
					},
					{
						probability: 0.5,
						quantity: 1,
					},
				],
				quantity: 3,
			}),
		).toBe(6);
	});

	it("uses the complete integer distribution instead of mean-yield division", () => {
		const result = readExpectedRuns({
			distribution: [
				{
					probability: 0.390625,
					quantity: 0,
				},
				{
					probability: 0.109375,
					quantity: 2,
				},
				{
					probability: 0.109375,
					quantity: 3,
				},
				{
					probability: 0.13541666666666666,
					quantity: 4,
				},
				{
					probability: 0.052083333333333336,
					quantity: 5,
				},
				{
					probability: 0.0798611111111111,
					quantity: 6,
				},
				{
					probability: 0.057291666666666664,
					quantity: 7,
				},
				{
					probability: 0.036458333333333336,
					quantity: 8,
				},
				{
					probability: 0.012152777777777778,
					quantity: 9,
				},
				{
					probability: 0.010416666666666666,
					quantity: 10,
				},
				{
					probability: 0.005208333333333333,
					quantity: 11,
				},
				{
					probability: 0.001736111111111111,
					quantity: 12,
				},
			],
			quantity: 12,
		});

		expect(result).toBeCloseTo(5.088_627_678_564_287);
		expect(result).not.toBeCloseTo(12 / 2.8125);
	});

	it("linearly interpolates fractional downstream demand", () => {
		expect(
			readExpectedRuns({
				distribution: [
					{
						probability: 0.5,
						quantity: 0,
					},
					{
						probability: 0.5,
						quantity: 1,
					},
				],
				quantity: 0.5,
			}),
		).toBe(1);
	});

	it("reports an impossible zero-progress distribution", () => {
		expect(
			readExpectedRuns({
				distribution: [
					{
						probability: 1,
						quantity: 0,
					},
				],
				quantity: 1,
			}),
		).toBe(Number.POSITIVE_INFINITY);
	});
});
