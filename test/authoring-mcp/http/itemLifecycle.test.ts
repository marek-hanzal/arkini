import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP item lifecycle", () => {
	it("renames title, previews deletion, and enforces revision-safe cleanup", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "item-lifecycle",
					},
					items: {
						water: {
							...editorTestPayload.config.items.water,
							merge: [
								{
									action: "use",
									effect: "keep",
									target: {
										type: "item",
										itemUid: "water",
									},
								},
							],
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		const note = await Effect.runPromise(
			repository.createNoteFx({
				projectId: "item-lifecycle",
				content: "Keep the design after deletion",
				resourceUids: [
					"item-water",
				],
				itemUids: [
					"water",
				],
			}),
		);
		ownership.setProjectContextFn("item-lifecycle");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const root = await Effect.runPromise(repository.readProjectRootFx("item-lifecycle"));
		if (root === null) throw new Error("Missing project root.");
		const originalBytes = await readFile(join(root, "artwork/item-water.png"));
		const renamed = await client.callTool({
			name: "rename_item",
			arguments: {
				itemUid: "water",
				title: "Fresh Water",
				revision: created.revision,
			},
		});
		expect(renamed.content).toMatchObject([
			{
				text: expect.stringContaining("Title: Fresh Water"),
			},
		]);
		let project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		if (project === null) throw new Error("Expected the renamed project.");
		expect(project?.config.items["water"]).toMatchObject({
			uid: "water",
			title: "Fresh Water",
			artwork: {
				default: [
					"item-water",
				],
			},
		});
		expect(project?.config.templates![0]!.board[0]?.itemUid).toBe("water");

		expect(project.revision).toBeGreaterThan(created.revision);
		expect(await readFile(join(root, "artwork/item-water.png"))).toEqual(originalBytes);
		expect(
			(await Effect.runPromise(repository.listNotesFx("item-lifecycle")))[0]?.resourceUids,
		).toEqual([
			"item-water",
		]);

		const impact = await client.callTool({
			name: "item_delete_impact",
			arguments: {
				itemUid: "water",
			},
		});
		const impactContent = impact.content[0];
		if (impactContent?.type !== "text") throw new Error("Missing delete impact text.");
		expect(impactContent.text).toContain(`Revision: ${project.revision}`);
		expect(impactContent.text).toContain("Safe delete: no");
		expect(impactContent.text).toContain("templates.0.board.0.itemUid");
		expect(() => JSON.parse(impactContent.text)).toThrow();

		const safe = await client.callTool({
			name: "delete_item",
			arguments: {
				itemUid: "water",
				revision: project.revision,
			},
		});
		expect(safe.isError).toBe(true);
		project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		if (project === null) throw new Error("Expected the unchanged project.");
		const renamedRevision = project.revision;
		expect(renamedRevision).toBeGreaterThan(created.revision);
		expect(notifyProjectChanged).toHaveBeenCalledOnce();

		const deleted = await client.callTool({
			name: "delete_item",
			arguments: {
				itemUid: "water",
				revision: renamedRevision,
				force: true,
			},
		});
		expect(deleted.content).toMatchObject([
			{
				text: expect.stringContaining("Mode: force"),
			},
		]);
		project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		expect(project?.revision).toBeGreaterThan(renamedRevision);
		expect(project?.config.items["water"]).toBeUndefined();
		expect(project?.config.templates![0]!.board).toEqual([]);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(2);
		const notes = await Effect.runPromise(repository.listNotesFx("item-lifecycle"));
		expect(notes).toEqual([
			{
				...note,
				resourceUids: [
					"item-water",
				],
				itemUids: [],
				updatedAtMs: expect.any(Number),
			},
		]);
		expect(notes[0]?.updatedAtMs).toBeGreaterThan(note.updatedAtMs);
	});
	it("rejects incomplete, stale and inherited-identity title edits without writing", async () => {
		const notify = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, notify);
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn(created.projectId);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const inherited = await client.callTool({
			name: "rename_item",
			arguments: {
				itemUid: "toString",
				title: "Must not persist",
				revision: created.revision,
			},
		});
		expect(inherited.isError).toBe(true);
		expect(inherited.content).toMatchObject([
			{
				text: expect.stringContaining("Item toString does not exist"),
			},
		]);
		expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).toEqual(
			created,
		);
		for (const args of [
			{
				id: "hero",
				title: "Must not persist",
			},
			{
				title: "Must not persist",
				revision: created.revision + 1,
			},
			{},
			{
				revision: created.revision + 1,
			},
		]) {
			const result = await client.callTool({
				name: "rename_item",
				arguments: {
					itemUid: "water",
					...args,
				},
			});
			expect(result.isError).toBe(true);
			expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).toEqual(
				created,
			);
		}
		expect(notify).not.toHaveBeenCalled();
		const titleOnly = await client.callTool({
			name: "rename_item",
			arguments: {
				itemUid: "water",
				title: "Fresh Water",
			},
		});
		expect(titleOnly.isError).not.toBe(true);
		let project = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(project?.config.items.water).toEqual({
			...created.config.items.water,
			title: "Fresh Water",
		});
		expect(project?.resources).toEqual(created.resources);
	});
});
