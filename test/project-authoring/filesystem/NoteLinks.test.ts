import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect, FileSystem, PlatformError } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";
import {
	createLine,
	createOutput,
	createProducerItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-note-links-");
});
afterEach(async () => harness.close());

describe("repository note item relationships", () => {
	it("persists UID links across authored-ID rename and freshness-guarded unlink without changing Versions", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const status = await Effect.runPromise(repository.readVersionStatusFx(project.projectId));
		const created = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "**Water** design",
				itemUids: [
					"water",
				],
				resourceIds: [],
			}),
		);
		expect(await Effect.runPromise(repository.readVersionStatusFx(project.projectId))).toEqual(
			status,
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
						board: [],
					},
					items: {
						renamed: {
							...project.config.items.water!,
							id: "renamed",
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
				resourceIds: [],
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
						resourceIds: [],
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
						board: [],
					},
					items: {
						...project.config.items,
						oil: {
							...project.config.items.water!,
							uid: "stable-oil",
							id: "oil",
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
					"stable-oil",
				],
				resourceIds: [],
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
					"stable-oil",
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

	it("rolls back a partially rewritten Notes set and item deletion, then strips every force-deleted owner on retry", async () => {
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let fail = false;
		let publishedNotes = 0;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) => {
				if (fail && String(to).includes("/notes/") && String(to).endsWith(".json")) {
					publishedNotes += 1;
					if (publishedNotes === 2) {
						fail = false;
						return Effect.fail(
							PlatformError.systemError({
								_tag: "Unknown",
								module: "FileSystem",
								method: "rename",
								description: "Injected second note publication failure",
							}),
						);
					}
				}
				return nodeFileSystem.rename(from, to);
			},
		};
		const repository = await harness.openRepository(fileSystem);
		const project = await harness.createProject(repository);
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "water-line",
					output: createOutput([
						{
							itemId: "water",
						},
					]),
				}),
			],
		});
		const prepared = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					items: {
						...project.config.items,
						producer,
					},
				},
			}),
		);
		for (const itemUids of [
			[
				"water",
				producer.uid,
			],
			[
				producer.uid,
			],
		]) {
			await Effect.runPromise(
				repository.createNoteFx({
					projectId: project.projectId,
					content: "Retain this Markdown",
					itemUids,
					resourceIds: [],
				}),
			);
		}
		const before = await Effect.runPromise(repository.listNotesFx(project.projectId));
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		const noteBytes = await Promise.all(
			before.map((note) => readFile(join(root!, "notes", `${note.noteId}.json`), "utf8")),
		);
		const request = {
			projectId: project.projectId,
			expectedRevision: prepared.revision,
			itemUid: "water",
			force: true,
		};
		fail = true;
		await expect(Effect.runPromise(repository.deleteItemFx(request))).rejects.toThrow(
			"could not be deleted",
		);
		expect(publishedNotes).toBe(2);
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.revision,
		).toBe(prepared.revision);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual(before);
		expect(
			await Promise.all(
				before.map((note) => readFile(join(root!, "notes", `${note.noteId}.json`), "utf8")),
			),
		).toEqual(noteBytes);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(
			(await Effect.runPromise(reopened.readProjectFx(project.projectId)))?.config,
		).toEqual(prepared.config);
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual(before);
		const deleted = await Effect.runPromise(reopened.deleteItemFx(request));
		expect(deleted.config.items).toEqual({});
		const after = await Effect.runPromise(reopened.listNotesFx(project.projectId));
		expect(after).toHaveLength(2);
		for (const note of after) {
			const original = before.find((candidate) => candidate.noteId === note.noteId)!;
			expect(note).toEqual({
				...original,
				itemUids: [],
				updatedAtMs: expect.any(Number),
			});
			expect(note.updatedAtMs).toBeGreaterThan(before[0]!.updatedAtMs);
		}
		await harness.closeRepository(reopened);
		const settled = await harness.openRepository();
		expect(await Effect.runPromise(settled.listNotesFx(project.projectId))).toEqual(after);
	});
});
