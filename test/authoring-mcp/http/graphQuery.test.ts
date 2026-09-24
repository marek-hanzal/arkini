import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { graphTextFn } from "./graphQuery.test/fixture";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("keeps MCP convenience queries on the canonical graph with exact edge identities and directions", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	const config = createJobTestConfig();
	const root = ItemSchema.parse({
		...config.items.forge,
		merge: [
			{
				target: {
					type: "item",
					itemUid: "water",
				},
				action: "consume",
				effect: "replace",
				result: "tool",
			},
		],
	});
	await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config: {
				...config,
				meta: {
					...config.meta,
					id: "graph-tools",
				},
				items: {
					...config.items,
					forge: root,
				},
			},
			resources: [],
		}),
	);
	ownership.setProjectContextFn("graph-tools");
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);

	for (const entry of [
		{
			name: "item_input",
			itemUid: "water",
			direction: "out",
			kinds: [
				"line-material",
				"line-unit-selector",
				"line-unit-cost",
			],
		},
		{
			name: "item_outcome",
			itemUid: "tool",
			direction: "in",
			kinds: [
				"line-item-outcome",
				"merge-item-outcome",
				"merge-replacement",
				"clock-item-outcome",
				"depletion-item-outcome",
			],
		},
	]) {
		const direct = graphTextFn(
			await client.callTool({
				name: "graph_query",
				arguments: {
					kind: "connections",
					from: `item:${entry.itemUid}`,
					direction: entry.direction,
					kinds: entry.kinds,
					maxDepth: 1,
				},
			}),
		);
		const convenience = graphTextFn(
			await client.callTool({
				name: entry.name,
				arguments: {
					itemUid: entry.itemUid,
				},
			}),
		);
		expect(convenience.text).toBe(direct.text);
		expect(convenience.operationIds).toEqual(direct.operationIds);
		expect(convenience.text).toMatch(
			/--(?:line-material|line-unit-selector|line-unit-cost|line-item-outcome|merge-item-outcome|merge-replacement|clock-item-outcome|depletion-item-outcome)-->/,
		);
	}
	const direct = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "traverse",
				from: "item:forge",
				direction: "out",
				kinds: [
					"line-item-outcome",
					"merge-replacement",
					"merge-target-replacement",
					"merge-item-outcome",
					"clock-item-outcome",
					"depletion-item-outcome",
					"merge-space",
					"space-outcome",
					"template-outcome",
					"start-template",
					"template-item",
				],
				maxDepth: 5,
			},
		}),
	);
	const chain = graphTextFn(
		await client.callTool({
			name: "item_chain",
			arguments: {
				itemUid: "forge",
			},
		}),
	);
	expect(chain.text).toBe(direct.text);
	expect(chain.operationIds).toEqual(direct.operationIds);
	expect(chain.text).toContain("merge-replacement");
	expect(chain.text).toContain("[item:forge]");
	expect(chain.text).toContain("[item:tool]");
});

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
		kind: "node",
		from: "item:water",
	};
	const first = graphTextFn(
		await client.callTool({
			name: "graph_query",
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
				name: "graph_query",
				arguments: {
					...query,
					revision: first.revision,
				},
			})
		).isError,
	).toBe(true);
	const changed = graphTextFn(
		await client.callTool({
			name: "graph_query",
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
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(refreshed.revision).toBe(changed.revision);
	expect(refreshed.snapshotId).not.toBe(changed.snapshotId);
	expect(refreshed.text).toContain("Reloaded without marker change [item:water]");
	ownership.setProjectContextFn("graph-second");
	const second = graphTextFn(
		await client.callTool({
			name: "graph_query",
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
	expect(discovery.querySchema.properties).toHaveProperty("maxExpansions");
	expect(discovery.querySchema.properties).not.toHaveProperty("detail");
	expect(discovery.querySchema.properties.kind.enum).toContain("operations");
	expect(discovery.batchSchema.properties.queries.maxItems).toBe(8);
	expect(discovery.operationReadSchema.required).toEqual(
		expect.arrayContaining([
			"revision",
			"snapshotId",
			"operationIds",
		]),
	);
	const noProject = await client.callTool({
		name: "graph_query",
		arguments: {
			kind: "node",
			from: "item:water",
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
	for (const query of [
		{
			kind: "node",
			from: "item:water",
			detail: "full",
		},
		{
			kind: "path",
			from: "item:water",
		},
		{
			kind: "connections",
			from: "item:water",
			limit: 201,
		},
		{
			kind: "traverse",
			from: "item:water",
			maxDepth: 13,
		},
		{
			kind: "traverse",
			from: "item:water",
			maxExpansions: 100001,
		},
		{
			kind: "node",
			from: "item:water",
			query: "[:find ?x :where [?x]]",
		},
	])
		expect(
			(
				await client.callTool({
					name: "graph_query",
					arguments: query,
				})
			).isError,
		).toBe(true);
	expect(
		(
			await client.callTool({
				name: "item_input",
				arguments: {
					itemUid: "water",
					detail: "full",
				},
			})
		).isError,
	).toBe(true);
	const limited = graphTextFn(
		await client.callTool({
			name: "graph_query",
			arguments: {
				kind: "connections",
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
