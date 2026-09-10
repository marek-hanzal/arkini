import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

const readTextFn = (
	result: Awaited<ReturnType<Awaited<ReturnType<typeof connectMcpClient>>["callTool"]>>,
) => {
	const content = result.content[0];
	if (content?.type !== "text") throw new Error("Expected MCP text content.");
	return content.text;
};

describe("editor MCP note asset links", () => {
	it("composes asset, item and content filters before pagination and freshness-guards asset unlinking", async () => {
		const notifyProjectChangedFn = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChangedFn,
		);
		const project = await Effect.runPromise(repository.createProjectFx(editorTestPayload));
		ownership.setProjectContextFn(project.projectId);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		for (const resourceIds of [
			[
				"missing",
			],
			[
				"hero",
				"hero",
			],
		]) {
			const result = await client.callTool({
				name: "create_note",
				arguments: {
					content: "Rejected art",
					itemUids: [
						"water",
					],
					resourceIds,
				},
			});
			expect(result.isError).toBe(true);
		}
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([]);
		expect(notifyProjectChangedFn).not.toHaveBeenCalled();

		const result = await client.callTool({
			name: "create_note",
			arguments: {
				content: "Water palette",
				itemUids: [
					"water",
				],
				resourceIds: [
					"hero",
					"item-water",
				],
			},
		});
		expect(result.isError).not.toBe(true);
		const [note] = await Effect.runPromise(repository.listNotesFx(project.projectId));
		if (note === undefined) throw new Error("Expected mixed-link note.");
		await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Newer palette note without item context",
				itemUids: [],
				resourceIds: [
					"hero",
				],
			}),
		);

		for (const resourceId of [
			"hero",
			"item-water",
		]) {
			const collection = readTextFn(
				await client.callTool({
					name: "note_collection",
					arguments: {
						itemUid: "water",
						resourceId,
						query: "PALETTE",
						limit: 1,
					},
				}),
			);
			expect(collection).toContain("Matched notes: 1");
			expect(collection).toContain(`- ${note.noteId}`);
			expect(collection).toContain('"id":"hero","type":"image","mime":"image/png"');
		}
		const unmatched = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					itemUid: "water",
					resourceId: "hero",
					query: "Newer",
				},
			}),
		);
		expect(unmatched).toContain("Matched notes: 0");
		const global = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {},
			}),
		);
		expect(global.split(`- ${note.noteId}`)).toHaveLength(2);
		const detail = JSON.parse(
			readTextFn(
				await client.callTool({
					name: "note_detail",
					arguments: {
						noteId: note.noteId,
					},
				}),
			),
		);
		expect(detail).toEqual({
			...note,
			linkedItems: [
				{
					uid: "water",
					id: "water",
					title: "Water",
				},
			],
			linkedAssets: [
				{
					id: "hero",
					type: "image",
					mime: "image/png",
				},
				{
					id: "item-water",
					type: "image",
					mime: "image/png",
				},
			],
		});

		const editInput = {
			noteId: note.noteId,
			content: note.content,
			itemUids: note.itemUids,
			expectedUpdatedAtMs: note.updatedAtMs,
		};
		const invalidEdit = await client.callTool({
			name: "edit_note",
			arguments: {
				...editInput,
				resourceIds: [
					"missing",
				],
			},
		});
		expect(invalidEdit.isError).toBe(true);
		const unlinked = await client.callTool({
			name: "edit_note",
			arguments: {
				...editInput,
				resourceIds: [
					"item-water",
				],
			},
		});
		expect(unlinked.isError).not.toBe(true);
		const updated = (await Effect.runPromise(repository.listNotesFx(project.projectId))).find(
			(candidate) => candidate.noteId === note.noteId,
		);
		expect(updated).toEqual({
			...note,
			resourceIds: [
				"item-water",
			],
			updatedAtMs: expect.any(Number),
		});
		expect(updated?.updatedAtMs).toBeGreaterThan(note.updatedAtMs);
		const stale = await client.callTool({
			name: "edit_note",
			arguments: {
				...editInput,
				resourceIds: [],
			},
		});
		expect(stale.isError).toBe(true);
		expect(readTextFn(stale)).toContain("changed after it was read");
		expect(notifyProjectChangedFn).toHaveBeenCalledTimes(2);
		const heroNotes = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					itemUid: "water",
					resourceId: "hero",
				},
			}),
		);
		expect(heroNotes).toContain("Matched notes: 0");
	});
});
