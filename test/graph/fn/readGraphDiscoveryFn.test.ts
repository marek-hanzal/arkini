import { describe, expect, it } from "vitest";
import { readGraphDiscoveryTextFn } from "~/authoring-mcp/tool/fn/readGraphDiscoveryTextFn";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { compileGraphOperationIndexFn } from "~/graph/fn/compileGraphOperationIndexFn";
import { readGraphDiscoveryFn as projectDiscoveryFn } from "~/graph/fn/readGraphDiscoveryFn";
import { readGraphOperationSummaryFn } from "~/graph/fn/readGraphOperationSummaryFn";
import type { GraphOperationParticipant } from "~/graph/type/GraphOperationIndex";
import type { GraphFacts } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";
import {
	adversarialConfigFn,
	configFn,
	itemFn,
	lineFn,
	outputFn,
	queryFn,
} from "./compileGraphFactsFn.test/fixtures";

const readGraphDiscoveryFn = (
	result: GraphResult,
	snapshotId: string,
	facts: GraphFacts,
	participants: readonly GraphOperationParticipant[] = [],
) => {
	const nodes = new Map(
		facts.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	return projectDiscoveryFn(
		result,
		snapshotId,
		{
			nodes,
			edges: new Map(
				facts.edges.map((edge) => [
					edge.id,
					edge,
				]),
			),
			operations: new Map(
				facts.operations.map((operation) => [
					operation.id,
					readGraphOperationSummaryFn(
						operation,
						nodes.get(operation.owner)?.title ?? operation.owner,
					),
				]),
			),
		},
		participants,
	);
};

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

it("retains relationship meaning while leaving outcome bookkeeping to hydration", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	const selected = facts.edges.find(
		(edge) =>
			edge.kind === "line-item-outcome" &&
			edge.annotations.outcome?.type === "item" &&
			edge.annotations.outcome.quantity.min === 2,
	)!;
	const compact = readGraphDiscoveryFn(
		{
			...resultFn(facts),
			edges: [
				selected,
			],
		},
		"snapshot",
		facts,
	);
	expect(compact.edges[0].metadata).toEqual({
		quantityMin: 2,
		quantityMax: 4,
		alternative: true,
		chance: 0,
		boardLocal: true,
	});
	const material = facts.edges.find(
		(edge) =>
			edge.kind === "line-material" &&
			edge.annotations.input?.type === "materials" &&
			edge.annotations.input.mode === "reserve",
	)!;
	const input = readGraphDiscoveryFn(
		{
			...resultFn(facts),
			edges: [
				material,
			],
		},
		"snapshot",
		facts,
	);
	expect(input.edges[0].metadata).toEqual({
		inputType: "materials",
		mode: "reserve",
		distance: "close",
		quantityMin: 1,
		quantityMax: 1,
		inputIndex: 1,
		boardLocal: true,
	});
});

it("keeps matching participant occurrences and their quantities separate without hydrating authored data", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	const operations = facts.operations.filter((operation) => operation.kind === "line");
	const participants = compileGraphOperationIndexFn(facts).participants.filter(
		(participant) =>
			participant.role === "output" &&
			operations.some((operation) => operation.id === participant.operationId),
	);
	const result = readGraphDiscoveryFn(
		{
			...resultFn(facts),
			operations,
			edges: [],
			nodes: [],
		},
		"snapshot",
		facts,
		participants,
	);
	expect(result.matches).toHaveLength(participants.length);
	expect(result.matches).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				nodeId: "item:B",
				role: "output",
				edgeKind: "line-item-outcome",
				metadata: expect.objectContaining({
					quantityMin: 2,
					quantityMax: 4,
					chance: 0,
					alternative: true,
				}),
			}),
		]),
	);
	expect(result.nodes.some((node) => node.id === "item:B")).toBe(true);
	expect(result.matches?.every((evidence) => evidence.role === "output")).toBe(true);
	expect(result.edges).toEqual([]);
	const ranked = [
		...facts.operations,
	].reverse();
	expect(
		readGraphDiscoveryFn(
			{
				...resultFn(facts),
				operations: ranked,
				edges: [],
			},
			"snapshot",
			facts,
		).operations.map((operation) => operation.id),
	).toEqual(ranked.map((operation) => operation.id));
});

it("attributes material quantity and selection distance to providers instead of the self unit payer", () => {
	const facts = factsFn(1);
	const participants = compileGraphOperationIndexFn(facts).participants.filter(
		(participant) => participant.role === "input",
	);
	const result = readGraphDiscoveryFn(
		{
			...resultFn(facts),
			edges: [],
		},
		"snapshot",
		facts,
		participants,
	);
	const payer = result.matches?.find((entry) => entry.edgeKind === "line-unit-cost");
	expect(payer).toMatchObject({
		nodeId: "item:A",
		metadata: {
			inputType: "materials",
			unitCost: 3,
			unitFrom: "self",
			inputIndex: 0,
			boardLocal: true,
		},
	});
	expect(payer?.metadata).not.toHaveProperty("quantityMin");
	expect(payer?.metadata).not.toHaveProperty("mode");
	expect(payer?.metadata).not.toHaveProperty("distance");
	expect(result.matches?.find((entry) => entry.edgeKind === "line-material")).toMatchObject({
		nodeId: "item:B",
		metadata: {
			quantityMin: 1,
			quantityMax: 2,
			mode: "reserve",
			distance: "far",
		},
	});
	const inputRows = readGraphDiscoveryTextFn(result, {
		kind: "operations",
	})
		.split("\n")
		.filter((row) => row.startsWith("  input:"));
	const payerRow = inputRows.find((row) => row.includes("line-unit-cost"))!;
	expect(payerRow).toContain("Puppy [item:A]");
	expect(payerRow).toContain("unitCost=3");
	expect(payerRow).toContain("unitFrom=self");
	expect(payerRow).not.toMatch(/×|mode=|distance=/);
	const materialRow = inputRows.find((row) => row.includes("line-material"))!;
	expect(materialRow).toContain("Fawn [item:B] ×1–2");
	expect(materialRow).toContain("mode=reserve");
	expect(materialRow).toContain("distance=far");
});

it("retains target-paid unit selection distance without leaking enclosing outcome quantities into guard references", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	const result = readGraphDiscoveryFn(
		{
			...resultFn(facts),
			edges: facts.edges,
		},
		"snapshot",
		facts,
	);
	const metadataFn = (kind: string, inputIndex: number) =>
		result.edges.find((edge) => edge.kind === kind && edge.metadata.inputIndex === inputIndex)
			?.metadata;
	expect(metadataFn("line-unit-selector", 2)).toMatchObject({
		unitCost: 3,
		unitFrom: "target",
		distance: "near",
	});
	expect(metadataFn("line-unit-cost", 2)).toMatchObject({
		unitCost: 3,
		unitFrom: "target",
		distance: "near",
	});
	expect(metadataFn("line-unit-selector", 5)).toMatchObject({
		unitCost: 1,
		unitFrom: "self",
		distance: "close",
	});
	expect(metadataFn("line-unit-cost", 5)).not.toHaveProperty("distance");
	expect(metadataFn("line-unit-cost", 3)).toMatchObject({
		inputType: "simple",
		unitCost: 1,
		unitFrom: "self",
	});
	const outcomeGuard = facts.edges.find(
		(edge) => edge.kind === "rule-reference" && edge.annotations.outcome?.type === "item",
	)!;
	expect(outcomeGuard).toBeDefined();
	const guard = result.edges.find((edge) => edge.id === outcomeGuard.id)!;
	expect(guard.metadata.distance).toBe(outcomeGuard.annotations.condition?.query.distance);
	expect(guard.metadata).not.toHaveProperty("quantityMin");
	expect(guard.metadata).not.toHaveProperty("quantityMax");
});
