import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";
let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-note-links-");
});
afterEach(async () => harness.close());

describe("repository note item relationships", () => {
	it("persists UID links across title rename and freshness-guarded unlink without changing authoring revision", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const created = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "**Water** design",
				itemUids: [
					"water",
				],
				resourceUids: [],
			}),
		);
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.revision,
		).toBe(project.revision);
		await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					start: {
						...project.config.start,
						spaces: [],
					},
					templates: [],
					items: {
						water: {
							...project.config.items.water!,
							title: "Renamed",
						},
					},
				},
			}),
		);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual([
			created,
		]);
		const unlinked = await Effect.runPromise(
			reopened.updateNoteFx({
				...created,
				expectedUpdatedAtMs: created.updatedAtMs,
				itemUids: [],
			}),
		);
		expect(unlinked).toEqual({
			...created,
			itemUids: [],
			updatedAtMs: expect.any(Number),
		});
		expect(unlinked.updatedAtMs).toBeGreaterThan(created.updatedAtMs);
		await expect(
			Effect.runPromise(
				reopened.updateNoteFx({
					...created,
					expectedUpdatedAtMs: created.updatedAtMs,
				}),
			),
		).rejects.toThrow("changed after it was read");
		const root = await Effect.runPromise(reopened.readProjectRootFx(project.projectId));
		expect(await readdir(join(root!, "notes"))).toEqual([
			`${created.noteId}.json`,
		]);
	});

	it("rejects duplicate and missing item links on both writes before changing stored notes", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const created = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Preserve",
				itemUids: [],
				resourceUids: [],
			}),
		);
		for (const itemUids of [
			[
				"water",
				"water",
			],
			[
				"missing",
			],
		]) {
			await expect(
				Effect.runPromise(
					repository.createNoteFx({
						projectId: project.projectId,
						content: "Rejected",
						itemUids,
						resourceUids: [],
					}),
				),
			).rejects.toBeDefined();
			await expect(
				Effect.runPromise(
					repository.updateNoteFx({
						...created,
						content: "Rejected",
						itemUids,
						expectedUpdatedAtMs: created.updatedAtMs,
					}),
				),
			).rejects.toBeDefined();
		}
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([
			created,
		]);
	});

	it("safe-deletes linked items without blockers and preserves other relationships and global notes", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const prepared = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					start: {
						...project.config.start,
						spaces: [],
					},
					templates: [],
					items: {
						...project.config.items,
						oil: {
							...project.config.items.water!,
							uid: "oil",
						},
					},
				},
			}),
		);
		const linked = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Shared",
				itemUids: [
					"water",
					"oil",
				],
				resourceUids: [],
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
		await Effect.runPromise(
			repository.deleteItemFx({
				projectId: project.projectId,
				expectedRevision: prepared.revision,
				itemUid: "water",
				force: false,
			}),
		);
		const notes = await Effect.runPromise(repository.listNotesFx(project.projectId));
		expect(notes).toEqual([
			{
				...linked,
				itemUids: [
					"oil",
				],
				updatedAtMs: expect.any(Number),
			},
			global,
		]);
		expect(notes[0]!.updatedAtMs).toBeGreaterThan(global.updatedAtMs);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual(notes);
	});
});
