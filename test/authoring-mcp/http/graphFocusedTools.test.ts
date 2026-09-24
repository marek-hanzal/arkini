import { afterEach, expect, it, vi } from "vitest";
import type { GraphOperationReadResult } from "~/graph/type/GraphDiscoveryResult";
import { cleanupMcpHarnesses } from "./support/createMcpHarness";
import { createGraphDiscoveryFixtureFn, graphTextFn, toolJsonFn } from "./graphQuery.test/fixture";

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupMcpHarnesses();
});

it("distinguishes a structural connection from an actual operation flow through focused MCP tools", async () => {
	const { client } = await createGraphDiscoveryFixtureFn();
	const search = graphTextFn(
		await client.callTool({
			name: "graph_search",
			arguments: {
				query: "Beagle Puppy",
				nodeKinds: [
					"item",
				],
			},
		}),
	);
	expect(search.text).toContain("Beagle Puppy [item:puppy]; kind=item");
	const path = graphTextFn(
		await client.callTool({
			name: "graph_path",
			arguments: {
				from: "item:fawn",
				to: "item:puppy",
				direction: "out",
				kinds: [
					"line-material",
				],
			},
		}),
	);
	expect(path.text).toMatch(/Status: yes/);
	const disconnected = graphTextFn(
		await client.callTool({
			name: "graph_flow",
			arguments: {
				from: "item:fawn",
				to: "item:puppy",
			},
		}),
	);
	expect(disconnected.text).toMatch(/Status: no; truncated: false/);
	const flow = graphTextFn(
		await client.callTool({
			name: "graph_flow",
			arguments: {
				from: "item:fawn",
				to: "item:paired",
				operationKinds: [
					"merge",
				],
			},
		}),
	);
	expect(flow.text).toMatch(/Status: yes/);
	expect(flow.text).toContain("Fawn [item:fawn] → Beagle Puppy With Fawn [item:paired]");
	expect(flow.text).toContain("participants: Beagle Puppy [item:puppy], Fawn [item:fawn]");
	expect(flow.text).not.toContain("edgeId=");
	const hydrated = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				revision: flow.revision,
				snapshotId: flow.snapshotId,
				operationIds: flow.operationIds,
			},
		}),
	);
	expect(hydrated.issues).toEqual([]);
	expect(hydrated.operations).toHaveLength(flow.operationIds.length);
	expect(hydrated.operations.every((operation) => operation.kind === "merge")).toBe(true);
});

it("renders mixed focused batches over one snapshot with query-local flows, errors and reusable connections continuation", async () => {
	const { client, repository } = await createGraphDiscoveryFixtureFn();
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const batch = graphTextFn(
		await client.callTool({
			name: "graph_batch",
			arguments: {
				queries: [
					{
						id: "links",
						query: {
							kind: "connections",
							from: "item:puppy",
							limit: 1,
						},
					},
					{
						id: "flow",
						query: {
							kind: "flow",
							from: "item:fawn",
							to: "item:paired",
						},
					},
					{
						id: "path",
						query: {
							kind: "path",
							from: "item:fawn",
							to: "item:puppy",
							kinds: [
								"line-material",
							],
						},
					},
					{
						id: "invalid",
						query: {
							kind: "flow",
							from: "item:fawn",
						},
					},
				],
			},
		}),
	);
	expect(readSpy).toHaveBeenCalledTimes(1);
	const [, links, flow, path, invalid] = batch.text.split(/^Query: /m);
	expect(links).toContain("truncated: true");
	expect(flow).toContain("truncated: false");
	expect(flow).toContain("Flow 1:");
	expect(path).toContain("Path 1:");
	expect(path).not.toContain("Flow 1:");
	expect(invalid).toContain("Error: invalid-query");
	expect(batch.nextCursor).toBeDefined();
	const next = graphTextFn(
		await client.callTool({
			name: "graph_connections",
			arguments: {
				from: "item:puppy",
				limit: 1,
				cursor: batch.nextCursor,
				revision: batch.revision,
				snapshotId: batch.snapshotId,
			},
		}),
	);
	expect(next.snapshotId).toBe(batch.snapshotId);
	expect(next.text).toMatch(/Status: yes/);
});

it("exposes aggregate counts and ranked owner pages through standalone and mixed batch MCP without operation payloads", async () => {
	const { client, repository } = await createGraphDiscoveryFixtureFn();
	const count = graphTextFn(
		await client.callTool({
			name: "graph_operations",
			arguments: {
				operationKinds: [
					"merge",
				],
				aggregate: {
					mode: "count",
				},
				limit: 1,
			},
		}),
	);
	expect(count.text).toContain("Count: 3");
	expect(count.text).toContain("truncated: false");
	expect(count.operationIds).toEqual([]);
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const request = {
		queries: [
			{
				id: "count",
				query: {
					kind: "operations",
					operationKinds: [
						"merge",
					],
					aggregate: {
						mode: "count",
					},
				},
			},
			{
				id: "owners",
				query: {
					kind: "operations",
					operationKinds: [
						"merge",
					],
					aggregate: {
						mode: "group",
						by: "owner",
					},
					limit: 1,
				},
			},
			{
				id: "matches",
				query: {
					kind: "operations",
					operationKinds: [
						"merge",
					],
					participant: "item:puppy",
					role: "target",
				},
			},
		],
	};
	const batch = graphTextFn(
		await client.callTool({
			name: "graph_batch",
			arguments: request,
		}),
	);
	expect(readSpy).toHaveBeenCalledTimes(1);
	expect(batch.snapshotId).toBe(count.snapshotId);
	const [, counted, owners, matches] = batch.text.split(/^Query: /m);
	expect(counted).toContain("Count: 3");
	expect(counted).not.toContain("operationId=");
	expect(owners).toContain("Beagle Puppy [item:puppy]: 2");
	expect(owners).not.toContain("operationId=");
	expect(matches).toContain("operationId=");
	expect(matches).toContain("target: Beagle Puppy [item:puppy]");
	expect(batch.nextCursor).toBeDefined();
	const second = graphTextFn(
		await client.callTool({
			name: "graph_operations",
			arguments: {
				operationKinds: [
					"merge",
				],
				aggregate: {
					mode: "group",
					by: "owner",
				},
				limit: 1,
				cursor: batch.nextCursor,
				revision: batch.revision,
				snapshotId: batch.snapshotId,
			},
		}),
	);
	expect(second.text).toContain("Fawn [item:fawn]: 1");
	expect(second.nextCursor).toBeUndefined();
	const partial = graphTextFn(
		await client.callTool({
			name: "graph_operations",
			arguments: {
				operationKinds: [
					"merge",
				],
				aggregate: {
					mode: "count",
				},
				maxExpansions: 1,
			},
		}),
	);
	expect(partial.text).toContain("Count: ≥1 (incomplete; total unknown)");
	expect(partial.text).toContain("truncated: true");
});
