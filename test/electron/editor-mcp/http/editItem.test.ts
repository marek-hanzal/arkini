import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createEditorItemDraftFn } from "~/item-authoring/domain/fn/createEditorItemDraftFn";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP item editing", () => {
	it("replaces supplied simple fields, clears null fields, and preserves the rest", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		const water = editorTestPayload.config.items.water;
		const producer = {
			...createEditorItemDraftFn({
				resourceId: editorTestPayload.resources[0]?.id ?? "missing-asset",
				type: "producer",
				uid: "producer-uid",
			}),
			id: "producer:test",
			title: "Test Producer",
			description: "Existing non-simple item.",
		};
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "edit-simple-project",
					},
					items: {
						...editorTestPayload.config.items,
						[producer.id]: producer,
						water: {
							...water,
							maxCount: 2,
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("edit-simple-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const readConfig = async (itemId: string) => {
			const result = await client.callTool({
				name: "item_config",
				arguments: {
					itemId,
				},
			});
			const content = result.content[0];
			if (content?.type !== "text")
				throw new Error(`Missing item_config text for ${itemId}.`);
			return JSON.parse(content.text) as unknown;
		};
		const waterConfig = {
			revision: created.revision,
			item: {
				...water,
				maxCount: 2,
			},
		};
		expect(await readConfig("water")).toEqual(waterConfig);
		expect(await readConfig(producer.id)).toEqual({
			revision: created.revision,
			item: producer,
		});

		const edited = await client.callTool({
			name: "edit_simple_item",
			arguments: {
				itemId: "water",
				revision: waterConfig.revision,
				patch: {
					maxCount: null,
					title: "Fresh Water",
				},
			},
		});
		const project = await Effect.runPromise(repository.readProjectFx("edit-simple-project"));
		if (project === null) throw new Error("Expected the edited project.");
		expect(edited).toMatchObject({
			content: [
				{
					text: [
						"Edited simple item.",
						"ID: water",
						"UID: water",
						`Revision: ${project.revision}`,
						"Replaced: maxCount, title",
					].join("\n"),
				},
			],
		});
		expect(project.config.items.water).toEqual({
			...water,
			title: "Fresh Water",
		});
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("edit-simple-project");
		const stale = await client.callTool({
			name: "edit_simple_item",
			arguments: {
				itemId: "water",
				revision: waterConfig.revision,
				patch: {
					title: "Stale title",
				},
			},
		});
		expect(stale).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining(
						`Revision ${created.revision} is stale; the open project is at revision ${project.revision}.`,
					),
				},
			],
		});

		for (const patch of [
			{},
			{
				id: "renamed-water",
			},
			{
				type: "producer",
			},
			{
				uid: "forced-water",
			},
		]) {
			const rejected = await client.callTool({
				name: "edit_simple_item",
				arguments: {
					itemId: "water",
					patch,
				},
			});
			expect(rejected.isError, JSON.stringify(patch)).toBe(true);
		}
		const wrongType = await client.callTool({
			name: "edit_simple_item",
			arguments: {
				itemId: producer.id,
				patch: {
					title: "Must not change",
				},
			},
		});
		expect(wrongType).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining(`Item ${producer.id} is producer, not simple.`),
				},
			],
		});
		expect(notifyProjectChanged).toHaveBeenCalledOnce();
		expect(
			(await Effect.runPromise(repository.readProjectFx("edit-simple-project")))?.revision,
		).toBe(project.revision);
	});
});
