import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-note-asset-links-");
});
afterEach(async () => harness.close());

describe("repository note asset relationships", () => {
	it("preserves links across resource title changes and removes only deleted resource links", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const hero = editorTestPayload.resources.find((resource) => resource.uid === "hero");
		if (hero === undefined) throw new Error("Expected the hero fixture resource.");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: project.projectId,
				resources: [
					"spare",
					"cover",
					"future",
				].map((uid) => ({
					uid,
					title: uid,
					path: join(root, "image", "hero.png"),
					size: hero.bytes.byteLength,
					type: "image" as const,
				})),
			}),
		);
		for (const resourceUids of [
			[
				"hero",
				"hero",
			],
			[
				"missing",
			],
		]) {
			await expect(
				Effect.runPromise(
					repository.createNoteFx({
						projectId: project.projectId,
						content: "Rejected asset links",
						itemUids: [],
						resourceUids,
					}),
				),
			).rejects.toBeDefined();
		}
		const linked = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Shared art direction",
				itemUids: [
					"water",
				],
				resourceUids: [
					"hero",
					"cover",
					"future",
					"spare",
				],
			}),
		);
		const global = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Global",
				itemUids: [],
				resourceUids: [],
			}),
		);
		await expect(
			Effect.runPromise(
				repository.updateNoteFx({
					...linked,
					expectedUpdatedAtMs: linked.updatedAtMs,
					resourceUids: [
						"missing",
					],
				}),
			),
		).rejects.toBeDefined();
		const restored = await Effect.runPromise(repository.readProjectFx(project.projectId));
		if (restored === null) throw new Error("Missing project");
		const beforeBytes = await readFile(join(root, "image", "hero.png"));
		const renamed = await Effect.runPromise(
			repository.saveResourceMetadataFx({
				projectId: project.projectId,
				expectedRevision: restored.revision,
				resourceUid: "hero",
				title: "Cover",
			}),
		);
		expect(renamed.config).toEqual(restored.config);
		expect(await readFile(join(root, "image", "hero.png"))).toEqual(beforeBytes);
		expect(renamed.resources.find(({ uid }) => uid === "hero")?.title).toBe("Cover");
		const afterRename = (
			await Effect.runPromise(repository.listNotesFx(project.projectId))
		).find((note) => note.noteId === linked.noteId);
		expect(afterRename).toEqual({
			...linked,
			resourceUids: [
				"hero",
				"cover",
				"future",
				"spare",
			],
			updatedAtMs: expect.any(Number),
		});
		expect(afterRename!.updatedAtMs).toBe(linked.updatedAtMs);

		await Effect.runPromise(
			repository.deleteResourceFx({
				expectedRevision: renamed.revision,
				projectId: project.projectId,
				resourceUid: "spare",
			}),
		);
		const afterDelete = await Effect.runPromise(repository.listNotesFx(project.projectId));
		expect(afterDelete).toEqual([
			{
				...afterRename,
				resourceUids: [
					"hero",
					"cover",
					"future",
				],
				updatedAtMs: expect.any(Number),
			},
			global,
		]);
		expect(afterDelete[0]!.updatedAtMs).toBeGreaterThan(afterRename!.updatedAtMs);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual(
			afterDelete,
		);
	});
});
