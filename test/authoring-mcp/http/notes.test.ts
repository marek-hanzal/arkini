import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
				version: {
					major: 1,
					minor: 0,
				},
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
				resourceUids: [],
				itemUids: [],
			}),
		);
		const second = await Effect.runPromise(
			repository.createNoteFx({
				projectId: "note-reading",
				content: "Second idea",
				resourceUids: [],
				itemUids: [],
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
		expect(page).toContain(`Note ID: ${second.noteId}`);
		expect(page).not.toContain(`Note ID: ${first.noteId}`);
		expect(page).toContain("Next page: 2");

		const search = readTextFn(
			await client.callTool({
				name: "note_collection",
				arguments: {
					query: "SEARCHABLE-TAIL",
				},
			}),
		);
		expect(search).toContain("Matched notes: 1");
		expect(search).toContain(`Note ID: ${first.noteId}`);
		expect(search).not.toContain("searchable-tail");

		const detail = readTextFn(
			await client.callTool({
				name: "note_detail",
				arguments: {
					noteId: first.noteId,
				},
			}),
		);
		expect(detail.slice(detail.indexOf("\nContent:\n") + "\nContent:\n".length)).toBe(
			firstContent,
		);
		expect(detail).toContain(`Note ID: ${first.noteId}`);
		expect(detail).toContain(`Updated at ms: ${first.updatedAtMs}`);
		const root = await Effect.runPromise(repository.readProjectRootFx("note-reading"));
		if (root === null) throw new Error("Expected project root.");
		const notePath = join(root, "notes", `${first.noteId}.json`);
		const file = JSON.parse(await readFile(notePath, "utf8"));
		await writeFile(
			notePath,
			JSON.stringify({
				...file,
				itemUids: [
					"absent-item",
				],
				resourceUids: [
					"absent-resource",
				],
			}),
		);
		await Effect.runPromise(repository.refreshProjectFx("note-reading"));
		const dangling = readTextFn(
			await client.callTool({
				name: "note_detail",
				arguments: {
					noteId: first.noteId,
				},
			}),
		);
		expect(dangling).toContain("Missing item [absent-item]");
		expect(dangling).toContain("Missing resource [absent-resource]");
		expect(dangling.endsWith(firstContent)).toBe(true);
	});

	it("creates, freshness-guards, and deletes notes while notifying only committed mutations", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
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
				resourceUids: [],
				itemUids: [],
			},
		});
		expect(createdResult.isError).not.toBe(true);
		const [created] = await Effect.runPromise(repository.listNotesFx("note-mutation"));
		if (created === undefined) throw new Error("Expected the created note.");
		expect(created.content).toBe("**MCP idea**");
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("note-mutation");

		const detail = readTextFn(
			await client.callTool({
				name: "note_detail",
				arguments: {
					noteId: created.noteId,
				},
			}),
		);
		const noteId = detail.match(/^Note ID: (.+)$/m)![1];
		const expectedUpdatedAtMs = Number(detail.match(/^Updated at ms: (\d+)$/m)![1]);
		const editedResult = await client.callTool({
			name: "edit_note",
			arguments: {
				noteId,
				expectedUpdatedAtMs,
				content: "Updated by MCP",
				resourceUids: [],
				itemUids: [],
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
				resourceUids: [],
				itemUids: [],
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
