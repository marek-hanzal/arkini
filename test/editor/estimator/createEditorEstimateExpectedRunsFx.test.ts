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
							{
								outputGroupId: "b",
								quantity: 1,
							},
						],
					},
					{
						probability: 0.5,
						quantities: [
							{
								outputGroupId: "a",
								quantity: 2,
							},
							{
								outputGroupId: "b",
								quantity: 2,
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
