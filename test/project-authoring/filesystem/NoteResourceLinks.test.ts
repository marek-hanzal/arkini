import { unlink } from "node:fs/promises";
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
	it("validates mixed links and rewrites only the affected resource relationship", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const hero = editorTestPayload.resources.find((resource) => resource.id === "hero");
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
				].map((id) => ({
					id,
					path: join(root, "image", "hero.png"),
					size: hero.bytes.byteLength,
					type: "image" as const,
				})),
			}),
		);
		for (const resourceIds of [
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
						resourceIds,
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
				resourceIds: [
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
				resourceIds: [],
			}),
		);
		await expect(
			Effect.runPromise(
				repository.updateNoteFx({
					...linked,
					expectedUpdatedAtMs: linked.updatedAtMs,
					resourceIds: [
						"missing",
					],
				}),
			),
		).rejects.toBeDefined();
		await unlink(join(root, "image", "cover.png"));
		await unlink(join(root, "image", "future.png"));
		const restored = await Effect.runPromise(repository.refreshProjectFx(project.projectId));

		const renamed = await Effect.runPromise(
			repository.replaceResourceFx({
				config: {
					...restored.config,
					resources: {
						...restored.config.resources,
						hero: "cover",
					},
				},
				currentId: "hero",
				expectedRevision: restored.revision,
				projectId: project.projectId,
				resource: {
					type: "image",
					id: "cover",
				},
			}),
		);
		const afterRename = (
			await Effect.runPromise(repository.listNotesFx(project.projectId))
		).find((note) => note.noteId === linked.noteId);
		expect(afterRename).toEqual({
			...linked,
			resourceIds: [
				"cover",
				"future",
				"spare",
			],
			updatedAtMs: expect.any(Number),
		});
		expect(afterRename!.updatedAtMs).toBeGreaterThan(global.updatedAtMs);

		await Effect.runPromise(
			repository.deleteResourceFx({
				expectedRevision: renamed.revision,
				projectId: project.projectId,
				resourceId: "spare",
			}),
		);
		const afterDelete = await Effect.runPromise(repository.listNotesFx(project.projectId));
		expect(afterDelete).toEqual([
			{
				...afterRename,
				resourceIds: [
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
