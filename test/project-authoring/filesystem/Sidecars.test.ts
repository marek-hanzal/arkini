import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-fs-sidecars-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project sidecars", () => {
	it("rejects stale note updates and deletes without changing the current note", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const created = await Effect.runPromise(
			repository.createNoteFx({
				itemUids: [],
				resourceIds: [],
				projectId: project.projectId,
				content: "Original note",
			}),
		);
		const updated = await Effect.runPromise(
			repository.updateNoteFx({
				itemUids: [],
				resourceIds: [],
				projectId: project.projectId,
				noteId: created.noteId,
				content: "Current note",
				expectedUpdatedAtMs: created.updatedAtMs,
			}),
		);

		await expect(
			Effect.runPromise(
				repository.updateNoteFx({
					itemUids: [],
					resourceIds: [],
					projectId: project.projectId,
					noteId: created.noteId,
					content: "Stale overwrite",
					expectedUpdatedAtMs: created.updatedAtMs,
				}),
			),
		).rejects.toThrow(`Editor note ${created.noteId} changed after it was read.`);
		await expect(
			Effect.runPromise(
				repository.deleteNoteFx({
					projectId: project.projectId,
					noteId: created.noteId,
					expectedUpdatedAtMs: created.updatedAtMs,
				}),
			),
		).rejects.toThrow(`Editor note ${created.noteId} changed after it was read.`);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([
			updated,
		]);

		await Effect.runPromise(
			repository.deleteNoteFx({
				projectId: project.projectId,
				noteId: created.noteId,
				expectedUpdatedAtMs: updated.updatedAtMs,
			}),
		);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([]);
	});

	it("refreshes and reopens notes whose exact IDs contain lone surrogates", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Expected the managed project root.");
		const notes = join(root, "notes");
		await mkdir(notes);
		const writeNote = (stem: string, content: string, timestamp: number) =>
			writeFile(
				join(notes, `${stem}.json`),
				`${JSON.stringify({
					content,
					createdAtMs: timestamp,
					updatedAtMs: timestamp,
				})}\n`,
			);
		await Promise.all([
			writeNote("%ED%A0%80", "High surrogate", 1),
			writeNote("%ED%B0%80", "Low surrogate", 2),
		]);

		await Effect.runPromise(repository.refreshProjectFx(project.projectId));
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([
			expect.objectContaining({
				noteId: "\udc00",
				itemUids: [],
				resourceIds: [],
			}),
			expect.objectContaining({
				noteId: "\ud800",
				itemUids: [],
				resourceIds: [],
			}),
		]);

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual([
			expect.objectContaining({
				noteId: "\udc00",
				itemUids: [],
				resourceIds: [],
			}),
			expect.objectContaining({
				noteId: "\ud800",
				itemUids: [],
				resourceIds: [],
			}),
		]);
	});

	it("keeps external Note edits hidden until Refresh without changing authoring revision", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Expected the managed project root.");
		const note = await Effect.runPromise(
			repository.createNoteFx({
				itemUids: [],
				resourceIds: [],
				projectId: project.projectId,
				content: "Editor-owned note",
			}),
		);
		const notePath = join(root, "notes", `${note.noteId}.json`);
		const noteFile = JSON.parse(await readFile(notePath, "utf8"));
		await writeFile(
			notePath,
			JSON.stringify({
				...noteFile,
				content: "Changed on disk",
				updatedAtMs: noteFile.updatedAtMs + 1,
			}),
		);
		expect(
			(await Effect.runPromise(repository.listNotesFx(project.projectId)))[0]?.content,
		).toBe("Editor-owned note");
		const refreshed = await Effect.runPromise(repository.refreshProjectFx(project.projectId));
		expect(refreshed.revision).toBe(project.revision);
		expect(
			(await Effect.runPromise(repository.listNotesFx(project.projectId)))[0]?.content,
		).toBe("Changed on disk");
	});
});
