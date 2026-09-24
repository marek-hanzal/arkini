import { expect, it } from "vitest";
import {
	readGraphBatchTextFn,
	readGraphDiscoveryTextFn,
} from "~/authoring-mcp/tool/fn/readGraphDiscoveryTextFn";
import type { GraphDiscoveryResult } from "~/graph/type/GraphDiscoveryResult";

const owner = 'item:puppy"\n]';
const target = "item:fawn";
const replacement = "item:puppy-fawn";
const operationId = JSON.stringify([
	owner,
	"merge",
	0,
]);
const edgeId = JSON.stringify([
	operationId,
	[
		"target",
		"itemUid",
	],
	"merge-target",
]);
const resultFn = (): GraphDiscoveryResult => ({
	projectId: "project",
	revision: 9,
	snapshotId: 'snapshot"\n',
	status: "yes",
	truncated: false,
	reasons: [],
	expansions: 1,
	nodes: [
		{
			id: owner,
			kind: "item",
			title: "Puppy",
		},
		{
			id: target,
			kind: "item",
			title: "Fawn",
		},
		{
			id: replacement,
			kind: "item",
			title: "Puppy with Fawn",
		},
	],
	edges: [
		{
			id: edgeId,
			from: owner,
			to: target,
			kind: "merge-target",
			operationId,
			metadata: {},
		},
	],
	operations: [
		{
			id: operationId,
			kind: "merge",
			title: "Puppy · Merge",
			owner,
			target,
			replacement,
			action: "consume",
			effect: "replace",
			ownership: "source",
			hasOutcomes: true,
		},
	],
	paths: [],
});
const readTokenFn = (text: string, name: string): unknown => {
	const encoded = text.match(new RegExp(`${name}=("(?:[^"\\\\]|\\\\.)*")`))?.[1];
	return encoded === undefined ? undefined : JSON.parse(encoded);
};

it("presents merge participants once and preserves exact opaque identities for hydration", () => {
	const result = resultFn();
	const text = readGraphDiscoveryTextFn(result, {
		kind: "operations",
	});
	expect(text).toContain(
		`Puppy [${JSON.stringify(owner)}] + Fawn [${JSON.stringify(target)}] → Puppy with Fawn [${JSON.stringify(replacement)}]`,
	);
	expect(text.match(/Puppy with Fawn/g)).toHaveLength(1);
	expect(readTokenFn(text, "operationId")).toBe(operationId);
	expect(text).toContain(
		"action=consume; effect=replace; ownership=source; additional outcomes=true",
	);
	expect(JSON.parse(text.match(/^Snapshot: (.+)$/m)![1])).toBe(result.snapshotId);
	expect(text).toContain("Revision: 9");
});

it("keeps reverse paths in traversal order while displaying authored edge direction", () => {
	const result = resultFn();
	const text = readGraphDiscoveryTextFn(
		{
			...result,
			paths: [
				{
					nodes: [
						target,
						owner,
					],
					edges: [
						edgeId,
					],
				},
			],
		},
		{
			kind: "path",
			from: target,
		},
	);
	expect(text).toContain(
		`Fawn [${JSON.stringify(target)}] <--merge-target-- Puppy [${JSON.stringify(owner)}]`,
	);
	expect(text).toContain(`replacement=Puppy with Fawn [${JSON.stringify(replacement)}]`);
	expect(readTokenFn(text, "edgeId")).toBe(edgeId);
	expect(readTokenFn(text, "operationId")).toBe(operationId);
});

it("retains line hydration identity without replaying operation details for every edge", () => {
	const result = resultFn();
	const lineUid = 'line"\n]';
	const lineId = JSON.stringify([
		"line",
		lineUid,
	]);
	const text = readGraphDiscoveryTextFn(
		{
			...result,
			operations: [
				{
					id: lineId,
					kind: "line",
					title: "Craft",
					owner,
					lineUid,
					runtimeMs: 5,
					default: true,
					clock: false,
					clockWeight: 1,
					show: true,
					enable: true,
					hasOutcomes: true,
				},
			],
			edges: [
				0,
				1,
			].map((index) => ({
				id: `edge-${index}`,
				from: target,
				to: owner,
				kind: "line-material",
				operationId: lineId,
				metadata: {
					mode: "reserve",
					distance: "far",
					quantityMin: 1,
					quantityMax: 2,
				},
			})),
		},
		{
			kind: "connections",
			from: owner,
		},
	);
	expect(readTokenFn(text, "lineUid")).toBe(lineUid);
	expect(text.match(/lineUid=/g)).toHaveLength(1);
	expect(text.match(/operationId=/g)).toHaveLength(2);
	expect(text).toContain("mode=reserve; distance=far; quantityMin=1; quantityMax=2");
});

it("renders one batch snapshot and preserves per-query partial results, errors and continuation", () => {
	const result = resultFn();
	const cursor = 'cursor"\n';
	const refs = {
		nodeIds: result.nodes.map((node) => node.id),
		edgeIds: [],
		operationIds: [
			operationId,
		],
		paths: [],
		expansions: 1,
	};
	const text = readGraphBatchTextFn(
		{
			...result,
			queries: [
				{
					id: "merges",
					...refs,
					status: "yes",
					truncated: true,
					reasons: [
						"limit",
					],
					nextCursor: cursor,
				},
				{
					id: "invalid",
					...refs,
					status: "unknown",
					truncated: false,
					reasons: [],
					error: {
						reason: "invalid-query",
						message: "Missing root",
					},
				},
			],
		},
		[
			{
				id: "merges",
				query: {
					kind: "operations",
				},
			},
			{
				id: "invalid",
				query: {
					kind: "path",
				},
			},
		],
	);
	expect(text.match(/^Project:/gm)).toHaveLength(1);
	expect(text.match(/^Revision:/gm)).toHaveLength(1);
	expect(text.match(/^Snapshot:/gm)).toHaveLength(1);
	const [merges, invalid] = text.split("Query: ").slice(1);
	expect(merges).toContain("Status: yes; truncated: true");
	expect(JSON.parse(merges.match(/^Cursor: (.+)$/m)![1])).toBe(cursor);
	expect(readTokenFn(merges, "operationId")).toBe(operationId);
	expect(invalid).toContain("Status: unknown; truncated: false");
	expect(invalid).toContain("Error: invalid-query; Missing root");
	expect(invalid).not.toContain("operationId=");
});
