import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import type { GraphOperationReadResult } from "~/graph/type/GraphDiscoveryResult";
import {
	configFn,
	itemFn,
	lineFn,
	outputFn,
} from "~test/graph/fn/compileGraphFactsFn.test/fixtures";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";
import { graphTextFn, toolJsonFn } from "./graphQuery.test/fixture";

afterEach(cleanupMcpHarnesses);

const fixtureFn = async () => {
	const harness = await createMcpHarness();
	const config = configFn({
		unlit: itemFn("unlit", {
			title: "Unlit Candle",
			clock: {
				intervalMs: 30000,
				durationMs: 30000,
			},
			lines: Array.from(
				{
					length: 6,
				},
				(_, index) =>
					lineFn(`light-${index}`, {
						runtimeMs: 30000,
						trigger: "clock-interval",
						weight: 30,
						outcome: outputFn("candle"),
					}),
			),
		}),
		candle: itemFn("candle", {
			title: "Candle",
		}),
	});
	await Effect.runPromise(
		harness.repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config,
			resources: [],
		}),
	);
	harness.ownership.setProjectContextFn(config.meta.id);
	await Effect.runPromise(harness.ownership.startLocalFx);
	return {
		config,
		client: await connectMcpClient(harness.port),
	};
};

it("uses five default flow paths in direct and batch calls and accepts an explicit limit of 200", async () => {
	const { client } = await fixtureFn();
	for (const [bounds, count] of [
		[
			{},
			5,
		],
		[
			{
				limit: 200,
			},
			6,
		],
	] as const) {
		const query = {
			from: "item:unlit",
			to: "item:candle",
			...bounds,
		};
		const direct = graphTextFn(
			await client.callTool({
				name: "graph_flow",
				arguments: query,
			}),
		);
		const batch = graphTextFn(
			await client.callTool({
				name: "graph_batch",
				arguments: {
					queries: [
						{
							id: "flow",
							query: {
								kind: "flow",
								...query,
							},
						},
					],
				},
			}),
		);
		for (const result of [
			direct,
			batch,
		]) {
			expect(result.text.match(/^Flow \d+:/gm)).toHaveLength(count);
			expect(result.text).toContain(`truncated: ${count === 5}`);
		}
		expect(batch.operationIds).toEqual(direct.operationIds);
	}
});

it("admits identical ranges through direct and batch tools, isolates removed aliases, and preserves canonical hydration", async () => {
	const { client, config } = await fixtureFn();
	for (const [bounds, count] of [
		[
			{
				gte: 30,
				lt: 120,
			},
			6,
		],
		[
			{
				gt: 30,
			},
			0,
		],
		[
			{
				lte: 30,
			},
			6,
		],
		[
			{
				lt: 30,
			},
			0,
		],
	] as const) {
		const query = {
			filter: {
				runtimeSeconds: bounds,
			},
		};
		const direct = graphTextFn(
			await client.callTool({
				name: "graph_operations",
				arguments: query,
			}),
		);
		const batch = graphTextFn(
			await client.callTool({
				name: "graph_batch",
				arguments: {
					queries: [
						{
							id: "matches",
							query: {
								kind: "operations",
								...query,
							},
						},
					],
				},
			}),
		);
		expect(direct.operationIds).toHaveLength(count);
		expect(batch.operationIds).toEqual(direct.operationIds);
	}
	const filters = [
		{
			runtimeMs: {
				gte: 30000,
			},
		},
		{
			durationMs: {
				gte: 30000,
			},
		},
		{
			intervalMs: {
				gte: 30000,
			},
		},
		{
			runtimeSeconds: {
				min: 30,
			},
		},
		{
			runtimeSeconds: {
				max: 30,
			},
		},
	];
	for (const filter of filters) {
		expect(
			(
				await client.callTool({
					name: "graph_operations",
					arguments: {
						filter,
					},
				})
			).isError,
		).toBe(true);
	}
	const batch = graphTextFn(
		await client.callTool({
			name: "graph_batch",
			arguments: {
				queries: [
					...filters.map((filter, index) => ({
						id: `invalid-${index}`,
						query: {
							kind: "operations",
							filter,
						},
					})),
					{
						id: "valid",
						query: {
							kind: "operations",
							filter: {
								runtimeSeconds: {
									gte: 30,
									lt: 120,
								},
							},
						},
					},
				],
			},
		}),
	);
	expect(batch.text.match(/Error: invalid-query/g)).toHaveLength(5);
	expect(batch.operationIds).toHaveLength(6);
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
	expect(hydrated.operations.map((operation) => operation.data)).toEqual(
		config.items.unlit.lines,
	);
});

it("publishes the same focused input contract in tools/list and graph_schema_json", async () => {
	const { client } = await fixtureFn();
	const { tools } = await client.listTools();
	const discovery = toolJsonFn<{
		querySchema: {
			oneOf: {
				properties: Record<string, unknown>;
				required?: string[];
			}[];
		};
	}>(
		await client.callTool({
			name: "graph_schema_json",
			arguments: {},
		}),
	);
	for (const tool of tools.filter((tool) =>
		/^graph_(search|connections|operations|path|flow|traverse|audit)$/.test(tool.name),
	)) {
		const kind = tool.name.slice("graph_".length);
		const variant = discovery.querySchema.oneOf.find(
			(variant) =>
				(
					variant.properties.kind as {
						const: string;
					}
				).const === kind,
		)!;
		const { kind: _kind, ...properties } = variant.properties;
		expect(tool.inputSchema.properties).toEqual(properties);
		expect(tool.inputSchema.required ?? []).toEqual(
			(variant.required ?? []).filter((key) => key !== "kind"),
		);
	}
	const flow = tools.find((tool) => tool.name === "graph_flow")!;
	expect(flow.inputSchema.properties?.limit).toMatchObject({
		default: 5,
		maximum: 200,
	});
	const operations = tools.find((tool) => tool.name === "graph_operations")!;
	const filter = operations.inputSchema.properties?.filter as {
		properties: Record<
			string,
			{
				properties: Record<string, unknown>;
			}
		>;
	};
	for (const key of [
		"runtimeMs",
		"durationMs",
		"intervalMs",
	])
		expect(filter.properties).not.toHaveProperty(key);
	for (const key of [
		"runtimeSeconds",
		"durationSeconds",
		"intervalSeconds",
		"weight",
	]) {
		expect(Object.keys(filter.properties[key].properties).sort()).toEqual([
			"gt",
			"gte",
			"lt",
			"lte",
		]);
	}
});
