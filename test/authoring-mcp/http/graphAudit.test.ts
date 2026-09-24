import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import {
	cleanupMcpHarnesses,
	createMcpHarness,
	connectMcpClient,
} from "./support/createMcpHarness";
import { graphTextFn, toolJsonFn } from "./graphQuery.test/fixture";
import { auditProjectFn } from "~test/graph/fx/graphAudit.test/fixtures";

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupMcpHarnesses();
});

it("serves audits, frozen pages and mixed graph batches through the registered MCP boundary", async () => {
	const harness = await createMcpHarness();
	const project = auditProjectFn();
	project.config.items.factory.lines[0].enable = false;
	await Effect.runPromise(
		harness.repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config: project.config,
			resources: [],
		}),
	);
	harness.ownership.setProjectContextFn(project.config.meta.id);
	await Effect.runPromise(harness.ownership.startLocalFx);
	const client = await connectMcpClient(harness.port);
	const first = graphTextFn(
		await client.callTool({
			name: "graph_audit",
			arguments: {
				audit: "dangling",
				limit: 1,
			},
		}),
	);
	expect(first.text).toContain("Audit matches: 2");
	expect(first.text).toContain("producer operations: 0");
	expect(first.nextCursor).toBeDefined();
	const next = graphTextFn(
		await client.callTool({
			name: "graph_audit",
			arguments: {
				audit: "dangling",
				limit: 1,
				cursor: first.nextCursor,
				revision: first.revision,
				snapshotId: first.snapshotId,
			},
		}),
	);
	expect(next.text).toContain("forgottenOther [item:forgottenOther]");
	expect(next.nextCursor).toBeUndefined();
	const readSpy = vi.spyOn(harness.repository, "readProjectFx");
	const batch = graphTextFn(
		await client.callTool({
			name: "graph_batch",
			arguments: {
				queries: [
					{
						id: "finished",
						query: {
							kind: "audit",
							audit: "dangling",
						},
					},
					{
						id: "release",
						query: {
							kind: "audit",
							audit: "source-only",
						},
					},
					{
						id: "operations",
						query: {
							kind: "operations",
							owner: "item:middle",
						},
					},
					{
						id: "flow",
						query: {
							kind: "flow",
							from: "item:root",
							to: "item:finished",
						},
					},
					{
						id: "invalid",
						query: {
							kind: "audit",
							audit: "dead-end",
						},
					},
				],
			},
		}),
	);
	expect(readSpy).toHaveBeenCalledTimes(1);
	const [, finished, release, operations, flow, invalid] = batch.text.split(/^Query: /m);
	expect(finished).toContain("Audit matches: 2");
	expect(release).toContain("templateOnly [item:templateOnly]");
	expect(operations).toContain("middle [item:middle]");
	expect(flow).toContain("middle [item:middle]");
	expect(invalid).toContain("Error: invalid-query");
	const usage = graphTextFn(
		await client.callTool({
			name: "graph_audit",
			arguments: {
				audit: "no-usage",
			},
		}),
	);
	expect(usage.operationIds.length).toBeGreaterThan(0);
	expect(usage.text).toContain("enable=false");
	const hydrated = toolJsonFn<{
		operations: {
			id: string;
			data: {
				enable?: boolean;
			};
		}[];
	}>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				operationIds: usage.operationIds,
				revision: usage.revision,
				snapshotId: usage.snapshotId,
			},
		}),
	);
	expect(hydrated.operations.map((operation) => operation.id).sort()).toEqual(
		[
			...usage.operationIds,
		].sort(),
	);
	expect(hydrated.operations.some((operation) => operation.data.enable === false)).toBe(true);

	const count = graphTextFn(
		await client.callTool({
			name: "graph_audit",
			arguments: {
				audit: "dangling",
				mode: "count",
			},
		}),
	);
	expect(count.text).toContain("Audit matches: 2");
	expect(count.text).not.toContain("[item:");
});
