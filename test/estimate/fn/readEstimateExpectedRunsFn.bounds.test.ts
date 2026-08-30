import { describe, expect, it } from "vitest";

import { readEstimateExpectedRunsFn } from "~/estimate/fn/readEstimateExpectedRunsFn";

describe("readEstimateExpectedRunsFn state bound", () => {
	it("rejects demand vectors above its explicit state bound", () => {
		expect(
			readEstimateExpectedRunsFn({
				distribution: [
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
			status: "state-space-unsupported",
		});
	});

	it("counts only reachable states for large correlated co-product demands", () => {
		expect(
			readEstimateExpectedRunsFn({
				distribution: [
					{
						probability: 0.75,
						quantities: [
							{
								outputGroupId: "hide",
								quantity: 1,
							},
							{
								outputGroupId: "sausage",
								quantity: 2,
							},
						],
					},
					{
						probability: 0.25,
						quantities: [
							{
								outputGroupId: "hide",
								quantity: 2,
							},
							{
								outputGroupId: "sausage",
								quantity: 2,
							},
						],
					},
				],
				demandByOutputGroupId: new Map([
					[
						"hide",
						84,
					],
					[
						"sausage",
						208,
					],
				]),
			}),
		).toEqual({
			runs: 104,
			status: "complete",
		});
	});

	it("bounds a wide sparse frontier before enqueueing excess states", () => {
		const distribution = Array.from(
			{
				length: 2 ** 3,
			},
			(_, index) => ({
				probability: 1 / 2 ** 3,
				quantities: [
					{
						outputGroupId: "a",
						quantity: index % 2,
					},
					{
						outputGroupId: "b",
						quantity: Math.floor(index / 2) % 2,
					},
					{
						outputGroupId: "c",
						quantity: Math.floor(index / 2 ** 2),
					},
				],
			}),
		);

		expect(
			readEstimateExpectedRunsFn({
				distribution,
				demandByOutputGroupId: new Map([
					[
						"a",
						30,
					],
					[
						"b",
						30,
					],
					[
						"c",
						30,
					],
				]),
			}),
		).toEqual({
			status: "state-space-unsupported",
		});
	});
});
