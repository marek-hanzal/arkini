import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorEstimateExpectedRunsFx } from "~/editor/estimator/createEditorEstimateExpectedRunsFx";

const expectedRuns = Effect.runSync(createEditorEstimateExpectedRunsFx());

describe("createEditorEstimateExpectedRunsFx", () => {
	it("keeps deterministic joint outputs in atomic operation batches", () => {
		const read = (demand: number) =>
			expectedRuns.read({
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

		expect(read(0.5)).toEqual({
			runs: 1,
			status: "complete",
		});
		expect(read(1.5)).toEqual({
			runs: 2,
			status: "complete",
		});
	});

	it("uses the correlated outcome vector when both stochastic co-products are required", () => {
		expect(
			expectedRuns.read({
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

	it("interpolates fractional joint demands from the surrounding integer states", () => {
		expect(
			expectedRuns.read({
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

	it("rejects demand vectors above its explicit state bound", () => {
		expect(
			expectedRuns.read({
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
			expectedRuns.read({
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
			(_, index) => {
				const a = index % 2;
				const b = Math.floor(index / 2) % 2;
				const c = Math.floor(index / 2 ** 2);
				return {
					probability: 1 / 2 ** 3,
					quantities: [
						{
							outputGroupId: "a",
							quantity: a,
						},
						{
							outputGroupId: "b",
							quantity: b,
						},
						{
							outputGroupId: "c",
							quantity: c,
						},
					],
				};
			},
		);
		expect(
			expectedRuns.read({
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

	it("does not apply the stochastic state bound to deterministic batches", () => {
		expect(
			expectedRuns.read({
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
