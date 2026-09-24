import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import type { GraphOperationReadResult } from "~/graph/type/GraphDiscoveryResult";
import { cleanupMcpHarnesses } from "./support/createMcpHarness";
import { createGraphDiscoveryFixtureFn, graphTextFn, toolJsonFn } from "./graphQuery.test/fixture";

afterEach(cleanupMcpHarnesses);

it("admits operation search and scalar filters over MCP and roundtrips compact continuation and hydration references", async () => {
	const { client, config, repository } = await createGraphDiscoveryFixtureFn();
	const initial = graphTextFn(
		await client.callTool({
			name: "graph_search",
			arguments: {
				query: "item:puppy",
			},
		}),
	);
	const puppy = config.items.puppy!;
	await Effect.runPromise(
		repository.upsertItemFx({
			projectId: config.meta.id,
			expectedRevision: initial.revision,
			item: {
				...puppy,
				lines: [
					"Digest",
					"Digest Meal",
					"Plague Exposure",
				].map((title, index) => ({
					...puppy.lines[0]!,
					uid: `audit-line-${index}`,
					title,
					clock: true,
					show: false,
					enable: true,
					clockWeight: 20,
				})),
			},
		}),
	);
	const query = {
		operationKinds: [
			"line",
		],
		search: {
			text: "Digest",
			scope: "title",
		},
		filter: {
			clock: true,
			show: false,
			enable: true,
			clockWeight: {
				gt: 15,
			},
		},
		limit: 1,
	};
	const first = graphTextFn(
		await client.callTool({
			name: "graph_operations",
			arguments: query,
		}),
	);
	expect(first.operationIds).toHaveLength(1);
	expect(first.operationIds[0]!.length).toBeLessThan(48);
	expect(first.nextCursor).toBeDefined();
	expect(first.nextCursor!.length).toBeLessThan(64);
	const pins = {
		revision: first.revision,
		snapshotId: first.snapshotId,
	};
	const next = graphTextFn(
		await client.callTool({
			name: "graph_operations",
			arguments: {
				...query,
				...pins,
				cursor: first.nextCursor,
			},
		}),
	);
	expect(next.operationIds).toHaveLength(1);
	expect(next.operationIds).not.toEqual(first.operationIds);
	expect(next.nextCursor).toBeUndefined();
	const hydrated = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				...pins,
				operationIds: [
					...first.operationIds,
					...next.operationIds,
				],
			},
		}),
	);
	expect(hydrated.issues).toEqual([]);
	expect(hydrated.operations.map((operation) => operation.data)).toMatchObject([
		{
			title: "Digest",
			clock: true,
			show: false,
			enable: true,
			clockWeight: 20,
		},
		{
			title: "Digest Meal",
			clock: true,
			show: false,
			enable: true,
			clockWeight: 20,
		},
	]);
	expect(
		(
			await client.callTool({
				name: "graph_operations",
				arguments: {
					...query,
					...pins,
					cursor: first.nextCursor,
					filter: {
						clock: false,
					},
				},
			})
		).isError,
	).toBe(true);
});

it("keeps participant match evidence local to each MCP batch section sharing the same operation", async () => {
	const { client } = await createGraphDiscoveryFixtureFn();
	const batch = graphTextFn(
		await client.callTool({
			name: "graph_batch",
			arguments: {
				queries: [
					{
						id: "input",
						query: {
							kind: "operations",
							operationKinds: [
								"line",
							],
							participant: "item:fawn",
							role: "input",
						},
					},
					{
						id: "owner",
						query: {
							kind: "operations",
							operationKinds: [
								"line",
							],
							participant: "item:puppy",
							role: "owner",
						},
					},
				],
			},
		}),
	);
	const [, input, owner] = batch.text.split(/^Query: /m);
	expect(batch.operationIds).toHaveLength(1);
	expect(input).toContain("input: Fawn [item:fawn] ×1");
	expect(input).toContain("mode=consume");
	expect(input).toContain("distance=far");
	expect(owner).toContain("owner: Beagle Puppy [item:puppy]");
	expect(owner).not.toContain("input:");
	expect(batch.text).not.toContain("edgeId=");
});
