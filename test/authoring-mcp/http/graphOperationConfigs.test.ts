import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { GraphOperationReadResult } from "~/graph/type/GraphDiscoveryResult";
import { cleanupMcpHarnesses } from "./support/createMcpHarness";
import { createGraphDiscoveryFixtureFn, graphTextFn, toolJsonFn } from "./graphQuery.test/fixture";

afterEach(cleanupMcpHarnesses);

it("hydrates only selected canonical operations and rejects a revision changed since discovery", async () => {
	const { client, config, repository } = await createGraphDiscoveryFixtureFn();
	const discovery = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "operations",
				owner: "item:puppy",
			},
		}),
	);
	const mergeId = discovery.operationIds.find((id) => id.includes('"merge"'))!;
	const lineId = discovery.operationIds.find((id) => id.includes('"line"'))!;
	expect(discovery.lineUids).toContain(config.items.puppy!.lines[0]!.uid);
	const pinned = {
		revision: discovery.revision,
		snapshotId: discovery.snapshotId,
	};
	const hydrated = toolJsonFn<GraphOperationReadResult>(
		await client.callTool({
			name: "graph_operations_json",
			arguments: {
				...pinned,
				operationIds: [
					mergeId,
					lineId,
					mergeId,
					"absent-operation",
				],
			},
		}),
	);
	expect(hydrated.revision).toBe(discovery.revision);
	expect(hydrated.snapshotId).toBe(discovery.snapshotId);
	expect(hydrated.operations.map(({ id }) => id)).toEqual([
		mergeId,
		lineId,
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
				mergeId,
			],
		},
		{
			revision: pinned.revision,
			operationIds: [
				mergeId,
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
				() => mergeId,
			),
		},
	])
		expect(
			(
				await client.callTool({
					name: "graph_operations_json",
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
				name: "graph_operations_json",
				arguments: {
					...pinned,
					operationIds: [
						mergeId,
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
	const first = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(first.operationIds).toHaveLength(1);
	expect(first.text).toMatch(/truncated: true/);
	expect(first.text).toMatch(/Reasons:.*limit/);
	expect(first.nextCursor).toBeTypeOf("string");
	const second = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				...query,
				cursor: first.nextCursor,
			},
		}),
	);
	expect(second.snapshotId).toBe(first.snapshotId);
	expect(second.operationIds).toHaveLength(1);
	expect(second.operationIds[0]!).not.toBe(first.operationIds[0]!);
	expect(second.text).toMatch(/truncated: false/);

	const root = await Effect.runPromise(repository.readProjectRootFx(config.meta.id));
	if (root === null) throw new Error("Missing fixture project root.");
	const path = join(root, "items", "puppy.json");
	const document = JSON.parse(await readFile(path, "utf8"));
	document.item.merge.reverse();
	await writeFile(path, JSON.stringify(document));
	await Effect.runPromise(repository.refreshProjectFx(config.meta.id));
	const changed = graphTextFn(
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
				name: "graph_operations_json",
				arguments: {
					...pinned,
					operationIds: [
						first.operationIds[0]!,
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
