import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	cleanupEditorMcpHarnesses,
	connectEditorMcpClient,
	createEditorMcpHarness,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

describe("editor MCP item lifecycle", () => {
	it("renames references, previews deletion, and enforces revision-safe cleanup", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "item-lifecycle",
				version: "1.0",
				config: {
					...editorTestPayload.config,
					items: {
						water: {
							...editorTestPayload.config.items.water,
							merge: [
								{
									action: "use",
									effect: "keep",
									target: {
										type: "item",
										itemId: "water",
									},
								},
							],
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("item-lifecycle");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);

		const renamed = await client.callTool({
			name: "rename_item",
			arguments: {
				itemId: "water",
				newItemId: "fresh-water",
				revision: 0,
			},
		});
		expect(renamed.content).toMatchObject([
			{
				text: expect.stringContaining("Updated references: 2"),
			},
		]);
		let project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		expect(project?.config.items.water).toBeUndefined();
		expect(project?.config.items["fresh-water"]).toMatchObject({
			id: "fresh-water",
			uid: "water",
		});
		expect(project?.config.start.board[0]?.itemId).toBe("fresh-water");

		const impact = await client.callTool({
			name: "item_delete_impact",
			arguments: {
				itemId: "fresh-water",
			},
		});
		const impactContent = impact.content[0];
		if (impactContent?.type !== "text") throw new Error("Missing delete impact text.");
		expect(impactContent.text).toContain("Revision: 1");
		expect(impactContent.text).toContain("Safe delete: no");
		expect(impactContent.text).toContain("start.board.0.itemId");
		expect(() => JSON.parse(impactContent.text)).toThrow();

		const safe = await client.callTool({
			name: "delete_item",
			arguments: {
				itemId: "fresh-water",
				revision: 1,
			},
		});
		expect(safe.isError).toBe(true);
		project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		expect(project?.revision).toBe(1);
		expect(notifyProjectChanged).toHaveBeenCalledOnce();

		const deleted = await client.callTool({
			name: "delete_item",
			arguments: {
				itemId: "fresh-water",
				revision: 1,
				force: true,
			},
		});
		expect(deleted.content).toMatchObject([
			{
				text: expect.stringContaining("Mode: force"),
			},
		]);
		project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		expect(project?.revision).toBe(2);
		expect(project?.config.items["fresh-water"]).toBeUndefined();
		expect(project?.config.start.board).toEqual([]);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(2);
	});
});
