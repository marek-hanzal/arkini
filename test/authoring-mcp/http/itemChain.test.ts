import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	clockFn,
	itemFn,
	lineFn,
	outputFn,
} from "~test/item-chain/fn/readItemChainsFn.test/fixtures";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("serves bounded Chain views from one projection, retaining branch identities and termination states", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const noProject = await client.callTool({
		name: "item_chain",
		arguments: {
			itemUid: "root",
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
						clock: {
							...clockFn("next"),
							intervalMs: 100,
						},
						lines: [
							lineFn("loop", true, outputFn("root")),
							lineFn("reward", true, outputFn("tool")),
						],
					}),
					next: itemFn("next", {
						clock: clockFn("tool"),
					}),
					wide: itemFn("wide", {
						clock: clockFn(
							...Array.from(
								{
									length: 405,
								},
								() => "tool",
							),
						),
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
			itemUid: "root",
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
			text: expect.stringContaining("- root [root] · Clock expiry"),
		},
	]);
	const missing = await client.callTool({
		name: "item_chain",
		arguments: {
			itemUid: "missing",
		},
	});
	expect(missing.isError).toBe(true);
	expect(missing.content).toEqual([
		{
			type: "text",
			text: expect.stringContaining("Item missing does not exist"),
		},
	]);
	const readTextFn = (response: typeof result) => {
		expect(response.isError).not.toBe(true);
		return (
			response.content as {
				type: "text";
				text: string;
			}[]
		)
			.map(({ text }) => text)
			.join("\n");
	};
	const fullText = readTextFn(result);
	const summaryText = readTextFn(
		await client.callTool({
			name: "item_chain",
			arguments: {
				itemUid: "root",
				detail: "summary",
			},
		}),
	);
	const outcomesFn = (text: string) =>
		text.split("Results:\n")[1]?.split(/Details:|Starting operations:/)[0];
	expect(outcomesFn(summaryText)).toBe(outcomesFn(fullText));
	expect(summaryText).toContain("Clock loop");
	expect(summaryText).toContain("Final item");
	expect(summaryText).toContain("Conditional or alternative");
	expect(summaryText).toContain("Clock line: loop [loop]");
	expect(summaryText).toContain("Clock line: reward [reward]");
	expect(summaryText).toContain("Clock expiry");
	expect(summaryText).toContain("next [next] ×1");
	expect(fullText).toContain("next [next] · Clock expiry");
	expect(summaryText).not.toContain("next [next] · Clock expiry");
	expect(summaryText).not.toContain("Details:");
	expect(summaryText.length).toBeLessThan(fullText.length);

	for (const detail of [
		"summary",
		"full",
	]) {
		const shallowText = readTextFn(
			await client.callTool({
				name: "item_chain",
				arguments: {
					itemUid: "root",
					detail,
					maxDepth: 1,
				},
			}),
		);
		expect(shallowText).toContain("next [next] · Depth limit");
		expect(shallowText).not.toContain("next [next] · Clock expiry");
		const truncatedText = readTextFn(
			await client.callTool({
				name: "item_chain",
				arguments: {
					itemUid: "wide",
					detail,
				},
			}),
		);
		expect(truncatedText).toContain("Truncated by safety limit: yes; some branches omitted");
		expect(truncatedText).toContain("Incomplete: expansion safety limit");
	}
});
