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
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					start: {
						...editorTestPayload.config.start,
						spaces: [],
					},
					items: {
						...editorTestPayload.config.items,
						clay: {
							...editorTestPayload.config.items.water,
							uid: "clay",
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
		]) {
			const result = await client.callTool({
				name: "create_note",
				arguments: {
					content: "Rejected links",
					resourceUids: [],
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
				resourceUids: [],
				itemUids: [
					"water",
					"clay",
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
				resourceUids: [],
				itemUids: [],
			}),
		);
		for (const itemUid of [
			"water",
			"clay",
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
			expect(result).toContain(`Note ID: ${note.noteId}`);
			expect(result).toContain("Potter's clay [clay]");
		}
		const global = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {},
			}),
		);
		expect(global.split(`Note ID: ${note.noteId}`)).toHaveLength(2);
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
				itemUid: "clay",
				title: "Potters clay",
				revision: project.revision,
			},
		});
		expect(renamed.isError).not.toBe(true);
		const detail = readTextFn(
			await client.callTool({
				name: "note_detail",
				arguments: {
					noteId: note.noteId,
				},
			}),
		);
		expect(detail).toContain("Water [water]");
		expect(detail).toContain("Potters clay [clay]");
		expect(detail).toContain(`Updated at ms: ${note.updatedAtMs}`);
		expect(detail.endsWith(note.content)).toBe(true);

		const invalidEdit = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId: note.noteId,
				content: note.content,
				expectedUpdatedAtMs: note.updatedAtMs,
				resourceUids: [],
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
				resourceUids: [],
				itemUids: [
					"clay",
				],
			},
		});
		expect(unlinked.isError).not.toBe(true);
		const updated = (await Effect.runPromise(repository.listNotesFx(project.projectId))).find(
			(candidate) => candidate.noteId === note.noteId,
		);
		expect(updated).toEqual({
			...note,
			resourceUids: [],
			itemUids: [
				"clay",
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
				resourceUids: [],
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
				itemUid: "clay",
				revision: current.revision,
			},
		});
		expect(deleted.isError).not.toBe(true);
		expect(notifyProjectChangedFn).toHaveBeenCalledExactlyOnceWith(project.projectId);
		const afterDelete = readTextFn(
			await client.callTool({
				name: "note_detail",
				arguments: {
					noteId: note.noteId,
				},
			}),
		);
		expect(afterDelete).not.toContain("[clay]");
		expect(afterDelete).not.toContain("[water]");
		expect(afterDelete.endsWith(note.content)).toBe(true);
		const afterDeleteUpdatedAtMs = Number(afterDelete.match(/^Updated at ms: (\d+)$/m)![1]);
		expect(afterDeleteUpdatedAtMs).toBeGreaterThan(updated?.updatedAtMs ?? 0);
	});
});
