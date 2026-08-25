import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	cleanupEditorMcpHarnesses,
	connectEditorMcpClient,
	createEditorMcpHarness,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

describe("editor MCP typed item editing", () => {
	it("edits every canonical item type through its dedicated replace-patch tool", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "edit-all-types-project",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("edit-all-types-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);
		const cases = [
			[
				"simple",
				{
					maxStackSize: 3,
				},
			],
			[
				"producer",
				{
					title: "Edited producer",
				},
			],
			[
				"craft",
				{
					title: "Edited craft",
				},
			],
			[
				"blueprint",
				{
					title: "Edited blueprint",
				},
			],
			[
				"deposit",
				{
					lines: null,
					title: "Edited deposit",
				},
			],
			[
				"stash",
				{
					title: "Edited stash",
				},
			],
			[
				"temporary",
				{
					durationMs: 1_000,
					output: null,
				},
			],
			[
				"inventory",
				{
					title: "Edited inventory",
				},
			],
		] as const;

		for (const [type] of cases) {
			const id = `${type === "producer" ? "producer" : "item"}:edit-${type}`;
			const created = await client.callTool({
				name: `create_${type}_item`,
				arguments: {
					id,
					title: `Original ${type}`,
					description: `Existing ${type} item.`,
					...(type === "producer" || type === "deposit"
						? {
								maxQueueSize: 4,
							}
						: {}),
				},
			});
			expect(created.isError, type).not.toBe(true);
		}

		for (const [type, patch] of cases) {
			const id = `${type === "producer" ? "producer" : "item"}:edit-${type}`;
			const edited = await client.callTool({
				name: `edit_${type}_item`,
				arguments: {
					itemId: id,
					patch,
				},
			});
			expect(edited.isError, type).not.toBe(true);
			expect(edited.content, type).toMatchObject([
				{
					text: expect.stringContaining(`Edited ${type} item.`),
				},
			]);
		}

		const project = await Effect.runPromise(repository.readProjectFx("edit-all-types-project"));
		for (const [type, patch] of cases) {
			const id = `${type === "producer" ? "producer" : "item"}:edit-${type}`;
			expect(project?.config.items[id], type).toMatchObject({
				...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null)),
				id,
				type,
				uid: expect.any(String),
			});
		}
		expect(project?.config.items["producer:edit-producer"]).toMatchObject({
			maxQueueSize: 4,
		});
		expect(project?.config.items["item:edit-deposit"]).toMatchObject({
			maxQueueSize: 4,
		});
		expect(project?.revision).toBe(cases.length * 2);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length * 2);

		for (const type of [
			"producer",
			"deposit",
		] as const) {
			const rejected = await client.callTool({
				name: `edit_${type}_item`,
				arguments: {
					itemId: `${type === "producer" ? "producer" : "item"}:edit-${type}`,
					patch: {},
				},
			});
			expect(rejected.isError, type).toBe(true);
		}
		expect(
			(await Effect.runPromise(repository.readProjectFx("edit-all-types-project")))?.revision,
		).toBe(cases.length * 2);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length * 2);
	});
});
