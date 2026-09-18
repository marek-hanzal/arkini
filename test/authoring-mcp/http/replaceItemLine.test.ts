import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP item line replacement", () => {
	it("reads and atomically replaces one complete revision-pinned line", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		const jobConfig = createJobTestConfig();
		const firstLine = jobConfig.items.forge.lines[0];
		if (firstLine === undefined) throw new Error("Expected the job fixture line.");
		const secondLine = {
			...firstLine,
			id: "line:forge:second",
			title: "Second line",
		};
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...jobConfig,
					meta: {
						...jobConfig.meta,
						id: "replace-line-project",
					},
					items: {
						...jobConfig.items,
						forge: {
							...jobConfig.items.forge,
							lines: [
								firstLine,
								secondLine,
							],
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn("replace-line-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const read = await client.callTool({
			name: "item_line_config",
			arguments: {
				itemId: "forge",
				lineId: firstLine.id,
			},
		});
		const readContent = read.content[0];
		if (readContent?.type !== "text") throw new Error("Missing item_line_config text.");
		expect(JSON.parse(readContent.text)).toEqual({
			revision: created.revision,
			itemId: "forge",
			line: firstLine,
		});

		const incomplete = await client.callTool({
			name: "replace_item_line",
			arguments: jsonToolInputFn({
				itemId: "forge",
				lineId: firstLine.id,
				revision: created.revision,
				line: {
					...firstLine,
					enable: undefined,
				},
			}),
		});
		expect(incomplete.isError).toBe(true);

		const replacement = {
			...firstLine,
			title: "Replacement line",
			description: "Completely replaced.",
			runtimeMs: 2_000,
			default: true,
			show: false,
			enable: false,
		};
		const replaced = await client.callTool({
			name: "replace_item_line",
			arguments: jsonToolInputFn({
				itemId: "forge",
				lineId: firstLine.id,
				revision: created.revision,
				line: replacement,
			}),
		});
		const project = await Effect.runPromise(repository.readProjectFx("replace-line-project"));
		if (project === null) throw new Error("Expected the edited project.");
		expect(replaced).toMatchObject({
			content: [
				{
					text: [
						"Replaced item line.",
						"Item ID: forge",
						`Line ID: ${firstLine.id}`,
						`Revision: ${project.revision}`,
					].join("\n"),
				},
			],
		});
		expect(project.config.items.forge.lines).toEqual([
			replacement,
			secondLine,
		]);
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("replace-line-project");

		for (const input of [
			{
				itemId: "forge",
				lineId: firstLine.id,
				revision: project.revision,
				line: {
					...replacement,
					id: "line:forge:wrong",
				},
			},
			{
				itemId: "forge",
				lineId: "line:forge:missing",
				revision: project.revision,
				line: {
					...replacement,
					id: "line:forge:missing",
				},
			},
			{
				itemId: "forge",
				lineId: firstLine.id,
				revision: created.revision,
				line: replacement,
			},
		]) {
			const rejected = await client.callTool({
				name: "replace_item_line",
				arguments: jsonToolInputFn(input),
			});
			expect(rejected.isError).toBe(true);
		}
		expect(notifyProjectChanged).toHaveBeenCalledOnce();
		expect(
			(await Effect.runPromise(repository.readProjectFx("replace-line-project")))?.revision,
		).toBe(project.revision);

		const ambiguousCommit = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				item: {
					...project.config.items.forge,
					lines: [
						replacement,
						{
							...secondLine,
							id: replacement.id,
						},
					],
				},
			}),
		);
		for (const call of [
			{
				name: "item_line_config",
				arguments: {
					itemId: "forge",
					lineId: replacement.id,
				},
			},
			{
				name: "replace_item_line",
				arguments: jsonToolInputFn({
					itemId: "forge",
					lineId: replacement.id,
					revision: ambiguousCommit.revision,
					line: replacement,
				}),
			},
		]) {
			const ambiguous = await client.callTool(call);
			expect(ambiguous.isError).toBe(true);
			expect(ambiguous.content[0]).toMatchObject({
				text: expect.stringContaining("is ambiguous"),
			});
		}
		expect(
			(await Effect.runPromise(repository.readProjectFx("replace-line-project")))?.revision,
		).toBe(ambiguousCommit.revision);
	});
});
