import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GraphResult } from "~/graph/type/GraphResult";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

const graphResultFn = (result: { content?: unknown; isError?: unknown }): GraphResult => {
	expect(result.isError).not.toBe(true);
	const content = result.content as {
		type: string;
		text: string;
	}[];
	return JSON.parse(content[0]!.text);
};

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
	for (const detail of [
		"summary",
		"full",
	] as const) {
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
			const direct = graphResultFn(
				await client.callTool({
					name: "graph_query",
					arguments: {
						kind: "connections",
						from: `item:${entry.itemUid}`,
						direction: entry.direction,
						kinds: entry.kinds,
						maxDepth: 1,
						detail,
					},
				}),
			);
			const convenience = graphResultFn(
				await client.callTool({
					name: entry.name,
					arguments: {
						itemUid: entry.itemUid,
						detail,
					},
				}),
			);
			expect(convenience).toEqual(direct);
			expect(convenience.edges.length).toBeGreaterThan(0);
		}
		const direct = graphResultFn(
			await client.callTool({
				name: "graph_query",
				arguments: {
					kind: "traverse",
					from: "item:forge",
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
					detail,
				},
			}),
		);
		const chain = graphResultFn(
			await client.callTool({
				name: "item_chain",
				arguments: {
					itemUid: "forge",
					detail,
				},
			}),
		);
		expect(chain).toEqual(direct);
		expect(chain.edges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					from: "item:forge",
					to: "item:tool",
					kind: "merge-replacement",
				}),
			]),
		);
	}
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
	const first = graphResultFn(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(first.nodes).toEqual([
		expect.objectContaining({
			title: "graph-first",
		}),
	]);
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
	const stale = await client.callTool({
		name: "graph_query",
		arguments: {
			...query,
			revision: first.revision,
		},
	});
	expect(stale.isError).toBe(true);
	const changed = graphResultFn(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(changed.revision).toBeGreaterThan(first.revision);
	expect(changed.nodes).toEqual([
		expect.objectContaining({
			title: "Changed",
		}),
	]);
	const root = await Effect.runPromise(repository.readProjectRootFx("graph-first"));
	if (root === null) throw new Error("Missing fixture project root.");
	const waterPath = join(root, "items", "water.json");
	const file = JSON.parse(await readFile(waterPath, "utf8"));
	file.item.title = "Reloaded without marker change";
	await writeFile(waterPath, JSON.stringify(file));
	await Effect.runPromise(repository.refreshProjectFx("graph-first"));
	const refreshed = graphResultFn(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(refreshed.revision).toBe(changed.revision);
	expect(refreshed.nodes[0].title).toBe("Reloaded without marker change");
	ownership.setProjectContextFn("graph-second");
	const second = graphResultFn(
		await client.callTool({
			name: "graph_query",
			arguments: query,
		}),
	);
	expect(second.projectId).toBe("graph-second");
	expect(second.nodes).toEqual([
		expect.objectContaining({
			title: "graph-second",
		}),
	]);
});

it("admits only bounded graph requests and exposes discovery without project context", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const schema = await client.callTool({
		name: "graph_schema",
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
			kind: "path",
			from: "item:water",
		},
		{
			kind: "connections",
			from: "item:water",
			limit: 1001,
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
	const limited = graphResultFn(
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
	expect(limited.truncated).toBe(true);
	expect(limited.reasons).toContain("limit");
	expect(limited.edges).toHaveLength(1);
});
