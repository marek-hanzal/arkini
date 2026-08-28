import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

const groups = [
	{
		name: "edits simple and craft items through their dedicated tools",
		projectId: "edit-simple-craft-project",
		cases: [
			[
				"simple",
				{
					maxStackSize: 3,
				},
			],
			[
				"craft",
				{
					title: "Edited craft",
				},
			],
		],
	},
	{
		name: "edits blueprint and inventory items through their dedicated tools",
		projectId: "edit-blueprint-inventory-project",
		cases: [
			[
				"blueprint",
				{
					title: "Edited blueprint",
				},
			],
			[
				"inventory",
				{
					title: "Edited inventory",
				},
			],
		],
	},
	{
		name: "edits producer and deposit items through their dedicated tools",
		projectId: "edit-producer-deposit-project",
		cases: [
			[
				"producer",
				{
					title: "Edited producer",
				},
			],
			[
				"deposit",
				{
					lines: null,
					title: "Edited deposit",
				},
			],
		],
	},
	{
		name: "edits stash and temporary items through their dedicated tools",
		projectId: "edit-stash-temporary-project",
		cases: [
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
		],
	},
] as const;

describe("editor MCP typed item editing", () => {
	it.each(groups)("$name", async ({ projectId, cases }) => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: projectId,
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext(projectId);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

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

		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		for (const [type, patch] of cases) {
			const id = `${type === "producer" ? "producer" : "item"}:edit-${type}`;
			expect(project?.config.items[id], type).toMatchObject({
				...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null)),
				id,
				type,
				uid: expect.any(String),
			});
		}
		if (cases.some(([type]) => type === "producer"))
			expect(project?.config.items["producer:edit-producer"]).toMatchObject({
				maxQueueSize: 4,
			});
		if (cases.some(([type]) => type === "deposit"))
			expect(project?.config.items["item:edit-deposit"]).toMatchObject({
				maxQueueSize: 4,
			});
		expect(project?.revision).toBeGreaterThan(created.revision);
		const revisionAfterEdits = project?.revision;
		expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length * 2);

		for (const type of cases
			.map(([type]) => type)
			.filter(
				(type): type is "producer" | "deposit" => type === "producer" || type === "deposit",
			)) {
			const rejected = await client.callTool({
				name: `edit_${type}_item`,
				arguments: {
					itemId: `${type === "producer" ? "producer" : "item"}:edit-${type}`,
					patch: {},
				},
			});
			expect(rejected.isError, type).toBe(true);
		}
		expect((await Effect.runPromise(repository.readProjectFx(projectId)))?.revision).toBe(
			revisionAfterEdits,
		);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length * 2);
	});
});
