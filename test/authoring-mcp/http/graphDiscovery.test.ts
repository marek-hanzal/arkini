import { afterEach, expect, it, vi } from "vitest";
import { cleanupMcpHarnesses } from "./support/createMcpHarness";
import { createGraphDiscoveryFixtureFn, graphTextFn, toolJsonFn } from "./graphQuery.test/fixture";
import type { GraphOperationReadResult } from "~/graph/type/GraphDiscoveryResult";

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupMcpHarnesses();
});

it("explains local and rootless merge interactions in text with exact identities for selective hydration", async () => {
	const { client } = await createGraphDiscoveryFixtureFn();
	const local = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "connections",
				from: "item:puppy",
			},
		}),
	);
	expect(local.text).toMatch(/Status: yes.*truncated: false/);
	expect(local.text).toContain("line-material");
	expect(local.text).toContain("merge-target");
	expect(local.text).toContain("Feed Puppy");
	expect(local.text).not.toContain("PRIVATE_");
	expect(local.text.trimStart().startsWith("{")).toBe(false);
	const all = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "operations",
				operationKinds: [
					"merge",
				],
			},
		}),
	);
	expect(all.operationIds).toHaveLength(3);
	expect(all.edgeIds).toHaveLength(0);
	const replacement = all.text
		.split("\n")
		.find((line) => line.includes("action=consume") && line.includes("effect=replace"));
	expect(replacement).toBeDefined();
	expect(replacement).toContain("Beagle Puppy");
	expect(replacement).toContain("Fawn");
	expect(replacement).toContain("Beagle Puppy With Fawn");
	expect(all.text).not.toContain("PRIVATE_");
	const target = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "operations",
				operationKinds: [
					"merge",
				],
				participant: "item:puppy",
				role: "target",
			},
		}),
	);
	expect(target.operationIds).toHaveLength(1);
	const hydrated = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				revision: target.revision,
				snapshotId: target.snapshotId,
				operationIds: target.operationIds,
			},
		}),
	);
	expect(hydrated.operations[0]).toMatchObject({
		kind: "merge",
		owner: "item:fawn",
		data: {
			target: {
				itemUid: "puppy",
			},
			result: "paired",
		},
	});
});

it("renders per-query batch results over one project read while preserving reusable IDs and isolated errors", async () => {
	const { client, repository } = await createGraphDiscoveryFixtureFn();
	const catalog = await client.listTools();
	expect(
		catalog.tools.find(({ name }) => name === "graph_query_batch")?.inputSchema,
	).toMatchObject({
		properties: {
			queries: {
				items: {
					properties: {
						query: {
							type: "object",
							additionalProperties: true,
						},
					},
				},
			},
		},
	});
	const query = {
		kind: "connections",
		from: "item:puppy",
	};
	const direct = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const batch = graphTextFn(
		await client.callTool({
			name: "graph_query_batch",
			arguments: {
				revision: direct.revision,
				snapshotId: direct.snapshotId,
				queries: [
					{
						id: "puppy",
						query,
					},
					{
						id: "overlap",
						query: {
							...query,
							limit: 1,
						},
					},
					{
						id: "invalid",
						query: {
							...query,
							maxDepth: 13,
						},
					},
				],
			},
		}),
	);
	expect(readSpy).toHaveBeenCalledTimes(1);
	expect(batch.revision).toBe(direct.revision);
	expect(batch.snapshotId).toBe(direct.snapshotId);
	expect(batch.text.trimStart().startsWith("{")).toBe(false);
	const sections = batch.text.split(/^Query: /m);
	expect(sections).toHaveLength(4);
	expect(sections[1]).toContain("puppy");
	expect(sections[1]).toMatch(/Status: yes.*truncated: false/);
	expect(sections[2]).toContain("overlap");
	expect(sections[2]).toMatch(/Status: yes.*truncated: true/);
	expect(sections[2]).toMatch(/Reasons:.*limit/);
	expect(sections[3]).toContain("invalid-query");
	expect(sections[3]).toMatch(/Status: unknown/);
	expect(new Set(batch.operationIds)).toEqual(new Set(direct.operationIds));
	const hydrated = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				revision: batch.revision,
				snapshotId: batch.snapshotId,
				operationIds: batch.operationIds,
			},
		}),
	);
	expect(hydrated.issues).toEqual([]);
	for (const queries of [
		[
			{
				id: "not-an-object",
				query: null,
			},
		],
		Array.from(
			{
				length: 9,
			},
			(_, index) => ({
				id: `query-${index}`,
				query,
			}),
		),
		[
			{
				id: "same",
				query,
			},
			{
				id: "same",
				query,
			},
		],
	])
		expect(
			(
				await client.callTool({
					name: "graph_query_batch",
					arguments: {
						queries,
					},
				})
			).isError,
		).toBe(true);
});

it("shows a reverse-discovered path with its original authored edge direction", async () => {
	const { client } = await createGraphDiscoveryFixtureFn();
	const path = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "path",
				from: "item:paired",
				to: "item:puppy",
				direction: "in",
				kinds: [
					"merge-replacement",
				],
				maxDepth: 1,
			},
		}),
	);
	expect(path.text).toMatch(/Status: yes/);
	expect(path.text).toContain("Beagle Puppy With Fawn");
	expect(path.text).toContain("<--merge-replacement--");
	expect(path.operationIds).toHaveLength(1);
	expect(path.edgeIds).toHaveLength(1);
	const detail = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				revision: path.revision,
				snapshotId: path.snapshotId,
				operationIds: path.operationIds,
			},
		}),
	);
	expect(detail.operations[0]).toMatchObject({
		owner: "item:puppy",
		kind: "merge",
		data: {
			result: "paired",
		},
	});
});
