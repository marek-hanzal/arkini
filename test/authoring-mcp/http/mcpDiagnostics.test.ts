import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { createMcpDiagnosticHandlerFx } from "~/authoring-mcp/http/createMcpDiagnosticHandlerFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("records pre-callback admission and stale tool errors without authored inputs or credentials", async () => {
	const records: createMcpDiagnosticHandlerFx.Record[] = [];
	const { ownership, port } = await createMcpHarness(Effect.runPromise, undefined, (record) =>
		Effect.sync(() => {
			records.push(record);
		}),
	);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const result = await client.callTool({
		name: "graph_query",
		arguments: {
			kind: "operations",
			kinds: [],
			search: {
				text: "Digest",
				scope: "title",
			},
			filter: {
				clock: true,
				clockWeight: {
					gt: 15,
				},
			},
		},
	});
	expect(result.isError).toBe(true);
	await expect
		.poll(() => records.some((record) => record.body.includes("kinds is not supported")))
		.toBe(true);
	const start = records.find((record) => record.message === "Editor MCP tool started")!;
	const end = records.find((record) => record.message === "Editor MCP tool completed")!;
	expect(end.body.split("\n")[0]).toBe(start.body.split("\n")[0]);
	expect(start.body).toContain('"kinds":[]');
	expect(start.body).toContain('"search":{"text":"Digest","scope":"title"}');
	expect(start.body).toContain('"filter":{"clock":true,"clockWeight":{"gt":15}}');
	expect(end.body).toContain("Outcome: tool error");
	await expect(
		client.callTool({
			name: "graph_schema",
			arguments: {
				authorization: "PRIVATE_AUTH",
				input: "PRIVATE_CONFIG",
			},
		}),
	).rejects.toThrow("Tool graph_schema not found");
	await expect
		.poll(() => records.some((record) => record.body.includes("Tool graph_schema not found")))
		.toBe(true);
	expect(JSON.stringify(records)).not.toContain("PRIVATE_AUTH");
	expect(JSON.stringify(records)).not.toContain("PRIVATE_CONFIG");
	const schema = await client.callTool({
		name: "graph_schema_json",
		arguments: {},
	});
	expect(schema.isError).not.toBe(true);
	await expect
		.poll(
			() => records.filter((record) => record.message === "Editor MCP tool completed").length,
		)
		.toBe(3);
	expect(JSON.stringify(records)).not.toContain('"querySchema":');
});

it("never changes MCP results when the diagnostics sink fails", async () => {
	const { ownership, port } = await createMcpHarness(Effect.runPromise, undefined, () =>
		Effect.fail(new Error("sink unavailable")),
	);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const response = await client.callTool({
		name: "graph_schema_json",
		arguments: {},
	});
	expect(response.isError).not.toBe(true);
});

it("records per-query batch errors while preserving successful siblings and omitting graph rows", async () => {
	const records: createMcpDiagnosticHandlerFx.Record[] = [];
	const { ownership, port, repository } = await createMcpHarness(
		Effect.runPromise,
		undefined,
		(record) =>
			Effect.sync(() => {
				records.push(record);
			}),
	);
	const config = createJobTestConfig();
	await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config,
			resources: [],
		}),
	);
	ownership.setProjectContextFn(config.meta.id);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const response = await client.callTool({
		name: "graph_query_batch",
		arguments: {
			queries: [
				{
					id: "valid",
					query: {
						kind: "node",
						from: "item:forge",
					},
				},
				{
					id: "invalid",
					query: {
						kind: "operations",
						kinds: [],
						filter: {
							clockWeight: {
								gt: 15,
							},
						},
					},
				},
			],
		},
	});
	expect(response.isError).not.toBe(true);
	await expect
		.poll(() => records.some((record) => record.body.includes("Error: invalid-query")))
		.toBe(true);
	const end = records.find((record) => record.message === "Editor MCP tool completed")!;
	const start = records.find((record) => record.message === "Editor MCP tool started")!;
	expect(start.body).toContain('"filter":{"clockWeight":{"gt":15}}');
	expect(end.body).toContain("Query: valid");
	expect(end.body).toContain("Status: yes");
	expect(end.body).toContain("Query: invalid");
	expect(end.body).toContain("kinds is not supported");
	expect(end.body).not.toContain("Nodes:");
});

it("stops pending response observation on close without recording a false completion", async () => {
	const records: createMcpDiagnosticHandlerFx.Record[] = [];
	const handler = createMcpHandler(
		() =>
			new McpServer({
				name: "diagnostics-test",
				version: "1",
			}),
	);
	const observed = Effect.runSync(
		createMcpDiagnosticHandlerFx({
			handler: {
				...handler,
				fetch: async () =>
					new Response(new ReadableStream<Uint8Array>(), {
						headers: {
							"content-type": "text/event-stream",
						},
					}),
			},
			readProjectContextFn: () => undefined,
			runPromiseFn: Effect.runPromise,
			writeMcpLogFx: (record) =>
				Effect.sync(() => {
					records.push(record);
				}),
		}),
	);
	const response = await observed.fetch(
		new Request("http://localhost/editor/mcp", {
			method: "POST",
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: {
					name: "graph_query",
					arguments: {
						kind: "operations",
					},
				},
			}),
		}),
	);
	await observed.close();
	await response.body?.cancel();
	await expect
		.poll(() =>
			records.some((record) => record.message === "Editor MCP response observation failed"),
		)
		.toBe(true);
	expect(records.some((record) => record.message === "Editor MCP tool completed")).toBe(false);
});

it("caps diagnostic capture without truncating the response delivered to the client", async () => {
	const records: createMcpDiagnosticHandlerFx.Record[] = [];
	const handler = createMcpHandler(
		() =>
			new McpServer({
				name: "diagnostics-test",
				version: "1",
			}),
	);
	const payload = JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		result: {
			content: [
				{
					type: "text",
					text: "private".repeat(100000),
				},
			],
		},
	});
	const observed = Effect.runSync(
		createMcpDiagnosticHandlerFx({
			handler: {
				...handler,
				fetch: async () =>
					new Response(payload, {
						headers: {
							"content-type": "application/json",
						},
					}),
			},
			readProjectContextFn: () => undefined,
			runPromiseFn: Effect.runPromise,
			writeMcpLogFx: (record) =>
				Effect.sync(() => {
					records.push(record);
				}),
		}),
	);
	try {
		const response = await observed.fetch(
			new Request("http://localhost/editor/mcp", {
				method: "POST",
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: {
						name: "graph_operations_json",
						arguments: {},
					},
				}),
			}),
		);
		expect(await response.text()).toBe(payload);
		await expect
			.poll(() =>
				records.some((record) => record.body.includes("response exceeds diagnostic limit")),
			)
			.toBe(true);
		expect(JSON.stringify(records)).not.toContain("private");
	} finally {
		await observed.close();
	}
});
