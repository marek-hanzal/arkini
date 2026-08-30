import { describe, expect, it } from "vitest";

import { createEstimateTopologyFn } from "~/estimate/fn/createEstimateTopologyFn";
import { materializeEstimateWitnessesFn } from "~/estimate/fn/materializeEstimateWitnessesFn";
import type { EditorAcquisitionGraph } from "~/flow/type/EditorAcquisitionGraph";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const {
	graph: graphFn,
	requirement: requirementFn,
	route: routeFn,
} = editorItemEstimateTestFixture;

const materializeFn = (graph: EditorAcquisitionGraph, factId: string, quantity: number) =>
	materializeEstimateWitnessesFn({
		requests: [
			{
				factId,
				quantity,
			},
		],
		topology: createEstimateTopologyFn(graph),
	})[0]!;

describe("materializeEstimateWitnessesFn", () => {
	it("uses whole deterministic batches for runs and upstream demand", () => {
		const entry = materializeFn(
			graphFn({
				facts: [
					"ore",
					"target",
				],
				roots: [
					"ore",
				],
				routes: [
					routeFn({
						allOf: [
							requirementFn("ore", "consume", 3),
						],
						durationMs: 10,
						id: "make-target",
						output: "target",
						outputQuantity: 2,
					}),
				],
			}),
			"target",
			5,
		);

		expect(entry.diagnostics).toEqual([]);
		const witness = entry.candidates[0]!;
		expect(witness.consumedByFact.get("ore")).toBe(9);
		expect(witness.selectedByFact.get("target")).toMatchObject({
			actionRuns: 3,
			outputRuns: 3,
		});
	});

	it("spends one finite root pool across additive sibling demand", () => {
		const entry = materializeFn(
			graphFn({
				facts: [
					"raw",
					"a",
					"b",
					"target",
				],
				roots: [
					{
						factId: "raw",
						quantity: 2,
					},
				],
				routes: [
					routeFn({
						durationMs: 10,
						id: "make-raw",
						output: "raw",
					}),
					routeFn({
						allOf: [
							requirementFn("raw", "consume", 2),
						],
						durationMs: 0,
						id: "make-a",
						output: "a",
					}),
					routeFn({
						allOf: [
							requirementFn("raw", "consume", 2),
						],
						durationMs: 0,
						id: "make-b",
						output: "b",
					}),
					routeFn({
						allOf: [
							requirementFn("a"),
							requirementFn("b"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
			"target",
			1,
		);

		const witness = entry.candidates[0]!;
		expect(witness.requiredQuantityByFact.get("raw")).toBe(4);
		expect(witness.selectedByFact.get("raw")?.producedQuantity).toBe(2);
	});

	it("shares correlated co-product work and its upstream demand", () => {
		const operation = {
			id: "make-a-and-b",
			inputs: [],
			outputDistribution: [
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
		} as const;
		const makeOutputFn = (factId: "a" | "b") =>
			routeFn({
				allOf: [
					requirementFn("fuel"),
				],
				durationMs: 10,
				id: `make-${factId}`,
				operation,
				operationOutputGroupId: factId,
				output: factId,
			});
		const entry = materializeFn(
			graphFn({
				facts: [
					"fuel",
					"a",
					"b",
					"target",
				],
				roots: [
					"fuel",
				],
				routes: [
					makeOutputFn("a"),
					makeOutputFn("b"),
					routeFn({
						allOf: [
							requirementFn("a"),
							requirementFn("b"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
			"target",
			1,
		);

		const witness = entry.candidates[0]!;
		expect(witness.sharedOperationIds).toEqual(
			new Set([
				"make-a-and-b",
			]),
		);
		expect(witness.consumedByFact.get("fuel")).toBe(1);
	});

	it("breaks only retained recurrence covered by a finite authored seed", () => {
		const entry = materializeFn(
			graphFn({
				facts: [
					"a",
					"b",
				],
				roots: [
					{
						factId: "a",
						quantity: 1,
					},
				],
				routes: [
					routeFn({
						allOf: [
							requirementFn("b", "one-time"),
						],
						durationMs: 10,
						id: "make-a",
						output: "a",
					}),
					routeFn({
						allOf: [
							requirementFn("a", "one-time"),
						],
						durationMs: 5,
						id: "make-b",
						output: "b",
					}),
				],
			}),
			"a",
			2,
		);

		const witness = entry.candidates[0]!;
		expect(witness.selectedByFact.get("b")?.recurrenceFactIds).toEqual(
			new Set([
				"a",
			]),
		);
	});
});
