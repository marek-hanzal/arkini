import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type {
	GraphDiscoveryResult,
	GraphOperationReadResult,
} from "~/graph/type/GraphDiscoveryResult";
import { cleanupMcpHarnesses } from "./support/createMcpHarness";
import { createGraphDiscoveryFixtureFn, toolJsonFn } from "./graphQuery.test/fixture";

afterEach(cleanupMcpHarnesses);

it("hydrates only selected canonical operations and rejects a revision changed since discovery", async () => {
	const { client, config, repository } = await createGraphDiscoveryFixtureFn();
	const discovery = toolJsonFn<GraphDiscoveryResult>(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "operations",
				owner: "item:puppy",
			},
		}),
	);
	const merge = discovery.operations.find(
		(operation) => operation.kind === "merge" && operation.target === "item:fawn",
	)!;
	const line = discovery.operations.find((operation) => operation.kind === "line")!;
	const pinned = {
		revision: discovery.revision,
		snapshotId: discovery.snapshotId,
	};
	const hydrated = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operation_configs",
			arguments: {
				...pinned,
				operationIds: [
					merge.id,
					line.id,
					merge.id,
					"absent-operation",
				],
			},
		}),
	);
	expect(hydrated.revision).toBe(discovery.revision);
	expect(hydrated.snapshotId).toBe(discovery.snapshotId);
	expect(hydrated.operations.map(({ id }) => id)).toEqual([
		merge.id,
		line.id,
	]);
	expect(hydrated.operations[0]).toMatchObject({
		kind: "merge",
		data: config.items.puppy!.merge![0],
	});
	expect(hydrated.operations[1]).toMatchObject({
		kind: "line",
		data: config.items.puppy!.lines[0],
	});
	expect(hydrated.issues).toEqual([
		{
			operationId: "absent-operation",
			reason: "missing-operation",
		},
	]);
	for (const input of [
		{
			operationIds: [
				merge.id,
			],
		},
		{
			revision: pinned.revision,
			operationIds: [
				merge.id,
			],
		},
		{
			...pinned,
			operationIds: [],
		},
		{
			...pinned,
			operationIds: Array.from(
				{
					length: 21,
				},
				() => merge.id,
			),
		},
	])
		expect(
			(
				await client.callTool({
					name: "graph_operation_configs",
					arguments: input,
				})
			).isError,
		).toBe(true);
	await Effect.runPromise(
		repository.upsertItemFx({
			projectId: config.meta.id,
			expectedRevision: discovery.revision,
			item: {
				...config.items.puppy!,
				merge: [
					config.items.puppy!.merge![1]!,
					config.items.puppy!.merge![0]!,
				],
			},
		}),
	);
	expect(
		(
			await client.callTool({
				name: "graph_operation_configs",
				arguments: {
					...pinned,
					operationIds: [
						merge.id,
					],
				},
			})
		).isError,
	).toBe(true);
});

it("pins operation continuation and hydration to content even after a same-revision merge reorder", async () => {
	const { client, config, repository } = await createGraphDiscoveryFixtureFn();
	const query = {
		kind: "operations",
		operationKinds: [
			"merge",
		],
		owner: "item:puppy",
		limit: 1,
	};
	const first = toolJsonFn<GraphDiscoveryResult>(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(first.operations).toHaveLength(1);
	expect(first.truncated).toBe(true);
	expect(first.reasons).toContain("limit");
	expect(first.nextCursor).toBeTypeOf("string");
	const second = toolJsonFn<GraphDiscoveryResult>(
		await client.callTool({
			name: "graph_query",
			arguments: {
				...query,
				cursor: first.nextCursor,
			},
		}),
	);
	expect(second.snapshotId).toBe(first.snapshotId);
	expect(second.operations).toHaveLength(1);
	expect(second.operations[0]!.id).not.toBe(first.operations[0]!.id);
	expect(second.truncated).toBe(false);

	const root = await Effect.runPromise(repository.readProjectRootFx(config.meta.id));
	if (root === null) throw new Error("Missing fixture project root.");
	const path = join(root, "items", "puppy.json");
	const document = JSON.parse(await readFile(path, "utf8"));
	document.item.merge.reverse();
	await writeFile(path, JSON.stringify(document));
	await Effect.runPromise(repository.refreshProjectFx(config.meta.id));
	const changed = toolJsonFn<GraphDiscoveryResult>(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(changed.revision).toBe(first.revision);
	expect(changed.snapshotId).not.toBe(first.snapshotId);
	const pinned = {
		revision: first.revision,
		snapshotId: first.snapshotId,
	};
	expect(
		(
			await client.callTool({
				name: "graph_operation_configs",
				arguments: {
					...pinned,
					operationIds: [
						first.operations[0]!.id,
					],
				},
			})
		).isError,
	).toBe(true);
	expect(
		(
			await client.callTool({
				name: "graph_query",
				arguments: {
					...query,
					cursor: first.nextCursor,
				},
			})
		).isError,
	).toBe(true);
});
