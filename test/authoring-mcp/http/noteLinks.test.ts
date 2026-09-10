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

describe("editor MCP note item links", () => {
	it("validates complete links, resolves renamed items, and freshness-guards unlinking", async () => {
		const notifyProjectChangedFn = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChangedFn,
		);
		const project = await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					start: {
						...editorTestPayload.config.start,
						board: [],
					},
					items: {
						...editorTestPayload.config.items,
						clay: {
							...editorTestPayload.config.items.water,
							uid: "clay-uid",
							id: "clay",
							title: "Potter's clay",
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn(project.projectId);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		for (const itemUids of [
			[
				"missing",
			],
			[
				"water",
				"water",
			],
			[
				"clay",
			],
		]) {
			const result = await client.callTool({
				name: "create_note",
				arguments: {
					content: "Rejected links",
					itemUids,
				},
			});
			expect(result.isError).toBe(true);
		}
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([]);
		expect(notifyProjectChangedFn).not.toHaveBeenCalled();

		const createdResult = await client.callTool({
			name: "create_note",
			arguments: {
				content: "Shared recipe",
				itemUids: [
					"water",
					"clay-uid",
				],
			},
		});
		expect(createdResult.isError).not.toBe(true);
		const [note] = await Effect.runPromise(repository.listNotesFx(project.projectId));
		if (note === undefined) throw new Error("Expected shared note.");
		await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Shared unlinked recipe",
				itemUids: [],
			}),
		);
		for (const itemUid of [
			"water",
			"clay-uid",
		]) {
			const result = readTextFn(
				await client.callTool({
					name: "note_collection",
					arguments: {
						itemUid,
						query: "RECIPE",
						limit: 1,
					},
				}),
			);
			expect(result).toContain("Matched notes: 1");
			expect(result).toContain(`- ${note.noteId}`);
			expect(result).toContain('"uid":"clay-uid","id":"clay","title":"Potter\'s clay"');
		}
		const global = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {},
			}),
		);
		expect(global.split(`- ${note.noteId}`)).toHaveLength(2);
		const mismatch = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					itemUid: "water",
					query: "unlinked",
				},
			}),
		);
		expect(mismatch).toContain("Matched notes: 0");

		const renamed = await client.callTool({
			name: "rename_item",
			arguments: {
				itemId: "clay",
				newItemId: "potters-clay",
				revision: project.revision,
			},
		});
		expect(renamed.isError).not.toBe(true);
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
				{
					uid: "clay-uid",
					id: "potters-clay",
					title: "Potter's clay",
				},
			],
		});

		const invalidEdit = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId: note.noteId,
				content: note.content,
				expectedUpdatedAtMs: note.updatedAtMs,
				itemUids: [
					"missing",
				],
			},
		});
		expect(invalidEdit.isError).toBe(true);
		const unlinked = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId: note.noteId,
				content: note.content,
				expectedUpdatedAtMs: note.updatedAtMs,
				itemUids: [
					"clay-uid",
				],
			},
		});
		expect(unlinked.isError).not.toBe(true);
		const updated = (await Effect.runPromise(repository.listNotesFx(project.projectId))).find(
			(candidate) => candidate.noteId === note.noteId,
		);
		expect(updated).toEqual({
			...note,
			itemUids: [
				"clay-uid",
			],
			updatedAtMs: expect.any(Number),
		});
		expect(updated?.updatedAtMs).toBeGreaterThan(note.updatedAtMs);
		const stale = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId: note.noteId,
				content: note.content,
				expectedUpdatedAtMs: note.updatedAtMs,
				itemUids: [],
			},
		});
		expect(stale.isError).toBe(true);
		expect(readTextFn(stale)).toContain("changed after it was read");
		const waterNotes = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					itemUid: "water",
				},
			}),
		);
		expect(waterNotes).toContain("Matched notes: 0");

		const current = await Effect.runPromise(repository.readProjectFx(project.projectId));
		if (current === null) throw new Error("Expected current project.");
		notifyProjectChangedFn.mockClear();
		const deleted = await client.callTool({
			name: "delete_item",
			arguments: {
				itemId: "potters-clay",
				revision: current.revision,
			},
		});
		expect(deleted.isError).not.toBe(true);
		expect(notifyProjectChangedFn).toHaveBeenCalledExactlyOnceWith(project.projectId);
		const afterDelete = JSON.parse(
			readTextFn(
				await client.callTool({
					name: "note_detail",
					arguments: {
						noteId: note.noteId,
					},
				}),
			),
		);
		expect(afterDelete).toEqual({
			...note,
			itemUids: [],
			linkedItems: [],
			updatedAtMs: expect.any(Number),
		});
		expect(afterDelete.updatedAtMs).toBeGreaterThan(updated?.updatedAtMs ?? 0);
	});
});
