import { readFile, access } from "node:fs/promises";
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
	it("renames references, previews deletion, and enforces revision-safe cleanup", async () => {
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
		const note = await Effect.runPromise(
			repository.createNoteFx({
				projectId: "item-lifecycle",
				content: "Keep the design after deletion",
				resourceIds: [
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
				itemId: "water",
				id: "fresh-water",
				title: "Fresh Water",
				artwork: true,
				revision: created.revision,
			},
		});
		expect(renamed.content).toMatchObject([
			{
				text: expect.stringContaining("Updated references: 2"),
			},
		]);
		let project = await Effect.runPromise(repository.readProjectFx("item-lifecycle"));
		if (project === null) throw new Error("Expected the renamed project.");
		expect(project?.config.items.water).toBeUndefined();
		expect(project?.config.items["fresh-water"]).toMatchObject({
			id: "fresh-water",
			uid: "water",
			title: "Fresh Water",
			artwork: {
				default: [
					"fresh-water",
				],
			},
		});
		expect(project?.config.templates![0]!.board[0]?.itemId).toBe("fresh-water");

		expect(project.revision).toBeGreaterThan(created.revision);
		expect(await readFile(join(root, "artwork/fresh-water.png"))).toEqual(originalBytes);
		await expect(access(join(root, "artwork/item-water.png"))).rejects.toThrow();
		expect(
			(await Effect.runPromise(repository.listNotesFx("item-lifecycle")))[0]?.resourceIds,
		).toEqual([
			"fresh-water",
		]);

		const impact = await client.callTool({
			name: "item_delete_impact",
			arguments: {
				itemId: "fresh-water",
			},
		});
		const impactContent = impact.content[0];
		if (impactContent?.type !== "text") throw new Error("Missing delete impact text.");
		expect(impactContent.text).toContain(`Revision: ${project.revision}`);
		expect(impactContent.text).toContain("Safe delete: no");
		expect(impactContent.text).toContain("templates.0.board.0.itemId");
		expect(() => JSON.parse(impactContent.text)).toThrow();

		const safe = await client.callTool({
			name: "delete_item",
			arguments: {
				itemId: "fresh-water",
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
				itemId: "fresh-water",
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
		expect(project?.config.items["fresh-water"]).toBeUndefined();
		expect(project?.config.templates![0]!.board).toEqual([]);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(2);
		const notes = await Effect.runPromise(repository.listNotesFx("item-lifecycle"));
		expect(notes).toEqual([
			{
				...note,
				resourceIds: [
					"fresh-water",
				],
				itemUids: [],
				updatedAtMs: expect.any(Number),
			},
		]);
		expect(notes[0]?.updatedAtMs).toBeGreaterThan(note.updatedAtMs);
	});
	it("rejects collisions and ambiguous artwork without partial edits; title and ID edits remain independent", async () => {
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
		for (const args of [
			{
				id: "hero",
				title: "Must not persist",
				artwork: true,
			},
			{
				title: "Must not persist",
				artwork: true,
			},
			{},
			{
				id: "fresh-water",
				revision: created.revision + 1,
			},
		]) {
			const result = await client.callTool({
				name: "rename_item",
				arguments: {
					itemId: "water",
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
				itemId: "water",
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
		const idOnly = await client.callTool({
			name: "rename_item",
			arguments: {
				itemId: "water",
				id: "fresh-water",
			},
		});
		expect(idOnly.isError).not.toBe(true);
		project = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(project?.config.items["fresh-water"]?.artwork.default).toEqual([
			"item-water",
		]);
		expect(project?.resources).toEqual(created.resources);
		if (project === null) throw new Error("Missing project.");
		await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					items: {
						"fresh-water": {
							...project.config.items["fresh-water"]!,
							artwork: {
								scale: 1,
								default: [
									"item-water",
									"item-water",
								],
							},
						},
					},
				},
			}),
		);
		const before = await Effect.runPromise(repository.readProjectFx(created.projectId));
		const ambiguous = await client.callTool({
			name: "rename_item",
			arguments: {
				itemId: "fresh-water",
				id: "clear-water",
				artwork: true,
			},
		});
		expect(ambiguous.isError).toBe(true);
		expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).toEqual(
			before,
		);
	});
});
