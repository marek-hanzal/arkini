import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { graphTextFn } from "./graphQuery.test/fixture";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("refreshes graph results after writes and project switches, rejecting stale revisions", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	const config = createJobTestConfig();
	for (const id of [
		"graph-first",
		"graph-second",
	])
		await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				resources: [],
				config: {
					...config,
					meta: {
						...config.meta,
						id,
					},
					items: {
						...config.items,
						water: {
							...config.items.water!,
							title: id,
						},
					},
				},
			}),
		);
	ownership.setProjectContextFn("graph-first");
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const query = {
		query: "item:water",
	};
	const first = graphTextFn(
		await client.callTool({
			name: "graph_search",
			arguments: query,
		}),
	);
	expect(first.text).toContain("graph-first [item:water]");
	await Effect.runPromise(
		repository.upsertItemFx({
			projectId: "graph-first",
			expectedRevision: first.revision,
			item: {
				...config.items.water!,
				title: "Changed",
			},
		}),
	);
	expect(
		(
			await client.callTool({
				name: "graph_search",
				arguments: {
					...query,
					revision: first.revision,
				},
			})
		).isError,
	).toBe(true);
	const changed = graphTextFn(
		await client.callTool({
			name: "graph_search",
			arguments: query,
		}),
	);
	expect(changed.revision).toBeGreaterThan(first.revision);
	expect(changed.text).toContain("Changed [item:water]");
	const root = await Effect.runPromise(repository.readProjectRootFx("graph-first"));
	if (root === null) throw new Error("Missing fixture project root.");
	const waterPath = join(root, "items", "water.json");
	const file = JSON.parse(await readFile(waterPath, "utf8"));
	file.item.title = "Reloaded without marker change";
	await writeFile(waterPath, JSON.stringify(file));
	await Effect.runPromise(repository.refreshProjectFx("graph-first"));
	const refreshed = graphTextFn(
		await client.callTool({
			name: "graph_search",
			arguments: query,
		}),
	);
	expect(refreshed.revision).toBe(changed.revision);
	expect(refreshed.snapshotId).not.toBe(changed.snapshotId);
	expect(refreshed.text).toContain("Reloaded without marker change [item:water]");
	ownership.setProjectContextFn("graph-second");
	const second = graphTextFn(
		await client.callTool({
			name: "graph_search",
			arguments: query,
		}),
	);
	expect(second.projectId).toBe("graph-second");
	expect(second.text).toContain("graph-second [item:water]");
});

it("admits only bounded graph requests and exposes discovery without project context", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const schema = await client.callTool({
		name: "graph_schema_json",
		arguments: {},
	});
	expect(schema.isError).not.toBe(true);
	const discovery = JSON.parse(
		(
			schema.content as {
				text: string;
			}[]
		)[0]!.text,
	);
	const variants = discovery.querySchema.oneOf as {
		properties: Record<string, unknown>;
	}[];
	expect(variants).toHaveLength(7);
	const operations = variants.find(
		({ properties }) =>
			(
				properties.kind as {
					const: string;
				}
			).const === "operations",
	)!;
	expect(operations.properties).toHaveProperty("maxExpansions");
	expect(operations.properties).not.toHaveProperty("detail");
	expect(discovery.batchSchema.properties.queries.maxItems).toBe(8);
	expect(discovery.operationReadSchema.required).toEqual(
		expect.arrayContaining([
			"revision",
			"snapshotId",
			"operationIds",
		]),
	);
	const noProject = await client.callTool({
		name: "graph_search",
		arguments: {
			query: "item:water",
		},
	});
	expect(noProject.isError).toBe(true);
	const config = createJobTestConfig();
	await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			resources: [],
			config,
		}),
	);
	ownership.setProjectContextFn(config.meta.id);
	for (const request of [
		{
			name: "graph_search",
			arguments: {
				query: "item:water",
				detail: "full",
			},
		},
		{
			name: "graph_path",
			arguments: {
				from: "item:water",
			},
		},
		{
			name: "graph_connections",
			arguments: {
				from: "item:water",
				limit: 201,
			},
		},
		{
			name: "graph_traverse",
			arguments: {
				from: "item:water",
				maxDepth: 13,
			},
		},
		{
			name: "graph_traverse",
			arguments: {
				from: "item:water",
				maxDepth: 2,
			},
		},
		{
			name: "graph_traverse",
			arguments: {
				from: "item:water",
				maxExpansions: 100001,
			},
		},
		{
			name: "graph_connections",
			arguments: {
				from: "item:water",
				query: "[:find ?x :where [?x]]",
			},
		},
	])
		expect((await client.callTool(request)).isError).toBe(true);
	const limited = graphTextFn(
		await client.callTool({
			name: "graph_connections",
			arguments: {
				from: "item:forge",
				direction: "in",
				limit: 1,
			},
		}),
	);
	expect(limited.text).toMatch(/truncated: true/);
	expect(limited.text).toMatch(/Reasons:.*limit/);
	expect(limited.text.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(1);
});
