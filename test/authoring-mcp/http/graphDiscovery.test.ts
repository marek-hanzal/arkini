import { afterEach, expect, it, vi } from "vitest";
import type { GraphBatchResult, GraphDiscoveryResult } from "~/graph/type/GraphDiscoveryResult";
import { cleanupMcpHarnesses } from "./support/createMcpHarness";
import { createGraphDiscoveryFixtureFn, toolJsonFn } from "./graphQuery.test/fixture";

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupMcpHarnesses();
});

it("discovers readable local and rootless merge interactions without transmitting authored documents", async () => {
	const { client } = await createGraphDiscoveryFixtureFn();
	const local = toolJsonFn<GraphDiscoveryResult>(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "connections",
				from: "item:puppy",
			},
		}),
	);
	expect(local.status).toBe("yes");
	expect(local.truncated).toBe(false);
	expect(local.edges).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				from: "item:puppy",
				to: "item:fawn",
				kind: "merge-target",
			}),
			expect.objectContaining({
				from: "item:fawn",
				to: "item:puppy",
				kind: "merge-target",
			}),
			expect.objectContaining({
				from: "item:fawn",
				to: "item:puppy",
				kind: "line-material",
			}),
		]),
	);
	const names = new Map(
		local.nodes.map((node) => [
			node.id,
			node.title,
		]),
	);
	const merge = local.operations.find(
		(operation) =>
			operation.kind === "merge" &&
			operation.owner === "item:puppy" &&
			operation.target === "item:fawn",
	);
	expect(merge?.kind).toBe("merge");
	if (merge?.kind !== "merge") throw new Error("Missing Puppy merge.");
	expect(
		`${names.get(merge.owner)} + ${names.get(merge.target!)} → ${names.get(merge.replacement!)}`,
	).toBe("Beagle Puppy + Fawn → Beagle Puppy With Fawn");
	expect(merge).toMatchObject({
		action: "consume",
		effect: "replace",
		hasOutcomes: false,
	});
	expect(JSON.stringify(local)).not.toContain("PRIVATE_");
	for (const operation of local.operations) expect(operation).not.toHaveProperty("data");
	for (const edge of local.edges) {
		expect(edge).not.toHaveProperty("annotations");
		expect(
			Object.values(edge.metadata).every(
				(value) => value === null || typeof value !== "object",
			),
		).toBe(true);
	}

	const all = toolJsonFn<GraphDiscoveryResult>(
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
	expect(all.operations).toHaveLength(3);
	expect(all.operations.every((operation) => operation.kind === "merge")).toBe(true);
	const targets = toolJsonFn<GraphDiscoveryResult>(
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
	expect(targets.operations).toEqual([
		expect.objectContaining({
			owner: "item:fawn",
			target: "item:puppy",
			replacement: "item:paired",
		}),
	]);
	expect(targets.nodes.map(({ title }) => title).sort()).toEqual([
		"Beagle Puppy",
		"Beagle Puppy With Fawn",
		"Fawn",
	]);
});

it("reads one project snapshot for overlapping batch queries and isolates malformed siblings", async () => {
	const { client, repository } = await createGraphDiscoveryFixtureFn();
	const query = {
		kind: "connections",
		from: "item:puppy",
	};
	const direct = toolJsonFn<GraphDiscoveryResult>(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const batch = toolJsonFn<GraphBatchResult>(
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
						query,
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
	expect(batch.nodes).toEqual(direct.nodes);
	expect(batch.edges).toEqual(direct.edges);
	expect(batch.operations).toEqual(direct.operations);
	for (const payload of [
		batch.nodes,
		batch.edges,
		batch.operations,
	])
		expect(new Set(payload.map(({ id }) => id)).size).toBe(payload.length);
	for (const result of batch.queries.slice(0, 2)) {
		expect(result).toMatchObject({
			status: direct.status,
			truncated: direct.truncated,
			reasons: direct.reasons,
		});
		expect(result.nodeIds).toEqual(direct.nodes.map(({ id }) => id));
		expect(result.edgeIds).toEqual(direct.edges.map(({ id }) => id));
		expect(result.operationIds).toEqual(direct.operations.map(({ id }) => id));
	}
	expect(batch.queries[2]).toMatchObject({
		id: "invalid",
		status: "unknown",
		error: {
			reason: "invalid-query",
		},
		nodeIds: [],
		edgeIds: [],
		operationIds: [],
	});
	for (const queries of [
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
