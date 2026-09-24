import { describe, expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { readGraphDiscoveryFn } from "~/graph/fn/readGraphDiscoveryFn";
import type { GraphFacts } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";
import { configFn, itemFn, lineFn, outputFn, queryFn } from "./compileGraphFactsFn.test/fixtures";

const resultFn = (facts: GraphFacts): GraphResult => ({
	projectId: "project",
	revision: 7,
	status: "yes",
	truncated: false,
	reasons: [],
	expansions: 2,
	nodes: facts.nodes.filter((node) => node.id === "item:A"),
	edges: facts.edges.filter(
		(edge) => edge.kind === "merge-target" || edge.kind === "line-material",
	),
	operations: facts.operations.filter((operation) => operation.owner === "item:A"),
	paths: [],
});

const factsFn = (count: number) =>
	compileGraphFactsFn(
		configFn({
			A: itemFn("A", {
				title: "Puppy",
				lines: [
					lineFn("line", {
						description: "large authored prose ".repeat(count),
						input: [
							{
								type: "materials",
								query: queryFn("B"),
								mode: "reserve",
								quantity: {
									min: 1,
									max: 2,
								},
								units: {
									from: "self",
									cost: 3,
								},
							},
						],
						rules: Array.from(
							{
								length: count,
							},
							() => ({
								type: "enable",
								when: [
									{
										type: "exists",
										query: queryFn("B"),
									},
								],
							}),
						),
					}),
				],
				merge: [
					{
						action: "consume",
						effect: "replace",
						target: {
							type: "item",
							itemUid: "B",
						},
						result: "C",
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: Array.from(
												{
													length: count,
												},
												() => outputFn("D").set[0].roll[0].outcome[0],
											),
										},
									],
								},
							],
						},
					},
				],
			}),
			B: itemFn("B", {
				title: "Fawn",
			}),
			C: itemFn("C", {
				title: "Puppy with Fawn",
			}),
			D: itemFn("D"),
		}),
	);

describe("compact graph discovery", () => {
	it("keeps selected discovery constant as hydrated rules, prose and unselected outcomes grow", () => {
		const small = factsFn(1);
		const large = factsFn(300);
		const compact = readGraphDiscoveryFn(resultFn(small), "snapshot", small);
		expect(readGraphDiscoveryFn(resultFn(large), "snapshot", large)).toEqual(compact);
		expect(compact.operations.find((operation) => operation.kind === "merge")).toMatchObject({
			owner: "item:A",
			target: "item:B",
			replacement: "item:C",
			action: "consume",
			effect: "replace",
			hasOutcomes: true,
		});
		expect(
			compact.nodes.map((node) => [
				node.id,
				node.title,
			]),
		).toEqual([
			[
				"item:A",
				"Puppy",
			],
			[
				"item:B",
				"Fawn",
			],
			[
				"item:C",
				"Puppy with Fawn",
			],
		]);
		expect(compact.edges.find((edge) => edge.kind === "line-material")?.metadata).toMatchObject(
			{
				inputType: "materials",
				mode: "reserve",
				quantityMin: 1,
				quantityMax: 2,
				unitCost: 3,
				unitFrom: "self",
			},
		);
		expect(compact.revision).toBe(7);
		expect(compact.snapshotId).toBe("snapshot");
	});

	it("includes reference titles for receiver transport and missing replacement without selecting edges", () => {
		const facts = compileGraphFactsFn(
			configFn({
				A: itemFn("A", {
					title: "Portal",
					merge: [
						{
							action: "space",
							space: 9,
							effect: "replace",
							result: "missing",
						},
					],
				}),
			}),
		);
		const result = readGraphDiscoveryFn(
			{
				...resultFn(facts),
				edges: [],
			},
			"snapshot",
			facts,
		);
		expect(result.operations).toEqual([
			{
				id: JSON.stringify([
					"item:A",
					"merge",
					0,
				]),
				kind: "merge",
				title: "Portal · Merge",
				owner: "item:A",
				hasOutcomes: false,
				action: "space",
				effect: "replace",
				ownership: "receiver",
				destination: "space:9",
				replacement: "item:missing",
			},
		]);
		expect(result.nodes).toEqual([
			{
				id: "item:A",
				kind: "item",
				title: "Portal",
			},
			{
				id: "item:missing",
				kind: "item",
				title: "missing",
				missing: true,
			},
			{
				id: "space:9",
				kind: "space",
				title: "Space 9",
			},
		]);
	});
});
