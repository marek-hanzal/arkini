import { readLineAuthoringFn } from "./support/readLineAuthoringFn";
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
			uid: "line:forge:second",
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
			name: "item_line_json",
			arguments: {
				itemUid: "forge",
				lineUid: firstLine.uid,
			},
		});
		const readContent = read.content[0];
		if (readContent?.type !== "text") throw new Error("Missing item_line_json text.");
		expect(JSON.parse(readContent.text)).toEqual({
			revision: created.revision,
			itemUid: "forge",
			line: firstLine,
		});

		const incomplete = await client.callTool({
			name: "replace_item_line",
			arguments: jsonToolInputFn({
				itemUid: "forge",
				lineUid: firstLine.uid,
				revision: created.revision,
				line: {
					...readLineAuthoringFn(firstLine),
					enable: undefined,
				},
			}),
		});
		expect(incomplete.isError).toBe(true);

		const replacement = {
			...firstLine,
			title: "Replacement line",
			description: "Completely replaced.",
			weight: 7,
			runtimeMs: 2_000,
			default: true,
			show: false,
			enable: false,
		};
		const replaced = await client.callTool({
			name: "replace_item_line",
			arguments: jsonToolInputFn({
				itemUid: "forge",
				lineUid: firstLine.uid,
				revision: created.revision,
				line: readLineAuthoringFn(replacement),
			}),
		});
		const project = await Effect.runPromise(repository.readProjectFx("replace-line-project"));
		if (project === null) throw new Error("Expected the edited project.");
		expect(replaced).toMatchObject({
			content: [
				{
					text: [
						"Replaced item line.",
						"Item UID: forge",
						`Line UID: ${firstLine.uid}`,
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
				itemUid: "forge",
				lineUid: firstLine.uid,
				revision: project.revision,
				line: {
					...readLineAuthoringFn(replacement),
					uid: "line:forge:wrong",
				},
			},
			{
				itemUid: "forge",
				lineUid: "line:forge:missing",
				revision: project.revision,
				line: {
					...readLineAuthoringFn(replacement),
					uid: "line:forge:missing",
				},
			},
			{
				itemUid: "forge",
				lineUid: firstLine.uid,
				revision: created.revision,
				line: readLineAuthoringFn(replacement),
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
	});
});
