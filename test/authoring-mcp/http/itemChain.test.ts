import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { clockFn, itemFn } from "~test/item-chain/fn/readItemChainsFn.test/fixtures";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("serves text Chain details from the active project and rejects missing items or depth overrides", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const tool = (await client.listTools()).tools.find(({ name }) => name === "item_chain");
	expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual([
		"itemId",
	]);
	const noProject = await client.callTool({
		name: "item_chain",
		arguments: {
			itemId: "root",
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
			config: {
				...config,
				meta: {
					...config.meta,
					id: "chain-project",
				},
				items: {
					...config.items,
					root: itemFn("root", {
						clock: clockFn("tool"),
					}),
				},
			},
			resources: [],
		}),
	);
	ownership.setProjectContextFn("chain-project");
	const result = await client.callTool({
		name: "item_chain",
		arguments: {
			itemId: "root",
		},
	});
	expect(result.isError).not.toBe(true);
	expect(result).not.toHaveProperty("structuredContent");
	expect(result.content).toEqual([
		{
			type: "text",
			text: expect.stringContaining("Item: root [root]"),
		},
	]);
	expect(result.content).toEqual([
		{
			type: "text",
			text: expect.stringContaining("Details:\n- root [root] · Clock expiry"),
		},
	]);
	const missing = await client.callTool({
		name: "item_chain",
		arguments: {
			itemId: "missing",
		},
	});
	expect(missing.isError).toBe(true);
	expect(missing.content).toEqual([
		{
			type: "text",
			text: expect.stringContaining("Item missing does not exist"),
		},
	]);
	const override = await client.callTool({
		name: "item_chain",
		arguments: {
			itemId: "root",
			depth: 12,
		},
	});
	expect(override.isError).toBe(true);
});
