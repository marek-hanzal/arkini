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

describe("editor MCP project notes", () => {
	it("lists newest notes with pagination and full-content search before reading exact detail", async () => {
		const { ownership, port, repository } = await createMcpHarness();
		await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "note-reading",
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		const firstContent = `# First idea\n\n${"x".repeat(260)} searchable-tail`;
		const first = await Effect.runPromise(
			repository.createNoteFx({
				projectId: "note-reading",
				content: firstContent,
			}),
		);
		const second = await Effect.runPromise(
			repository.createNoteFx({
				projectId: "note-reading",
				content: "Second idea",
			}),
		);
		ownership.setProjectContextFn("note-reading");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const page = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					page: 1,
					limit: 1,
				},
			}),
		);
		expect(page).toContain(`- ${second.noteId}`);
		expect(page).not.toContain(`- ${first.noteId}`);
		expect(page).toContain("Has next page: true");

		const search = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					query: "SEARCHABLE-TAIL",
				},
			}),
		);
		expect(search).toContain("Matched notes: 1");
		expect(search).toContain(`- ${first.noteId}`);
		expect(search).not.toContain("searchable-tail");

		const detail = JSON.parse(
			readTextFn(
				await client.callTool({
					name: "note_detail",
					arguments: {
						noteId: first.noteId,
					},
				}),
			),
		);
		expect(detail).toEqual(first);
	});

	it("creates, freshness-guards, and deletes notes while notifying only committed mutations", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "note-mutation",
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn("note-mutation");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const createdResult = await client.callTool({
			name: "create_note",
			arguments: {
				content: "**MCP idea**",
			},
		});
		expect(createdResult.isError).not.toBe(true);
		const [created] = await Effect.runPromise(repository.listNotesFx("note-mutation"));
		if (created === undefined) throw new Error("Expected the created note.");
		expect(created.content).toBe("**MCP idea**");
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("note-mutation");

		const editedResult = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId: created.noteId,
				expectedUpdatedAtMs: created.updatedAtMs,
				content: "Updated by MCP",
			},
		});
		expect(editedResult.isError).not.toBe(true);
		const [updated] = await Effect.runPromise(repository.listNotesFx("note-mutation"));
		if (updated === undefined) throw new Error("Expected the updated note.");
		expect(updated.content).toBe("Updated by MCP");
		expect(notifyProjectChanged).toHaveBeenCalledTimes(2);

		const staleEdit = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId: created.noteId,
				expectedUpdatedAtMs: created.updatedAtMs,
				content: "Stale overwrite",
			},
		});
		expect(staleEdit.isError).toBe(true);
		expect(readTextFn(staleEdit)).toContain("changed after it was read");
		expect(notifyProjectChanged).toHaveBeenCalledTimes(2);

		const staleDelete = await client.callTool({
			name: "delete_note",
			arguments: {
				noteId: created.noteId,
				expectedUpdatedAtMs: created.updatedAtMs,
			},
		});
		expect(staleDelete.isError).toBe(true);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(2);

		const deleted = await client.callTool({
			name: "delete_note",
			arguments: {
				noteId: updated.noteId,
				expectedUpdatedAtMs: updated.updatedAtMs,
			},
		});
		expect(deleted.isError).not.toBe(true);
		expect(await Effect.runPromise(repository.listNotesFx("note-mutation"))).toEqual([]);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(3);
	});
});
