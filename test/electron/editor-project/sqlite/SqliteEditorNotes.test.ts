import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => {
	vi.useFakeTimers({
		toFake: [
			"Date",
		],
	});
	vi.setSystemTime(1_000);
	harness = await createSqliteEditorProjectTestHarness("arkini-notes-");
});
afterEach(async () => {
	await harness.close();
	vi.useRealTimers();
});

describe("SQLite editor project notes", () => {
	it("persists a stable newest-first CRUD stream without changing the project revision", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const first = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "  First note  ",
			}),
		);
		const second = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Second note",
			}),
		);
		const updated = await Effect.runPromise(
			repository.updateNoteFx({
				projectId: project.projectId,
				noteId: first.noteId,
				content: "Edited first note",
			}),
		);

		expect(first.content).toBe("First note");
		expect(second.createdAtMs).toBeGreaterThan(first.createdAtMs);
		expect(updated.updatedAtMs).toBeGreaterThan(first.updatedAtMs);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([
			updated,
			second,
		]);
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.revision,
		).toBe(project.revision);
		await harness.closeRepository(repository);

		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual([
			updated,
			second,
		]);
		await Effect.runPromise(
			reopened.deleteNoteFx({
				projectId: project.projectId,
				noteId: first.noteId,
			}),
		);
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual([
			second,
		]);
	});

	it("isolates notes by project and cascades them with their owner", async () => {
		const repository = await harness.openRepository();
		const firstProject = await harness.createProject(repository, "project-a");
		const secondProject = await harness.createProject(repository, "project-b");
		await Effect.runPromise(
			repository.createNoteFx({
				projectId: firstProject.projectId,
				content: "First project",
			}),
		);
		const surviving = await Effect.runPromise(
			repository.createNoteFx({
				projectId: secondProject.projectId,
				content: "Second project",
			}),
		);

		await Effect.runPromise(repository.deleteProjectFx(firstProject.projectId));
		expect(await Effect.runPromise(repository.listNotesFx(secondProject.projectId))).toEqual([
			surviving,
		]);
		await expect(
			Effect.runPromise(repository.listNotesFx(firstProject.projectId)),
		).rejects.toThrow("does not exist");
	});

	it("stays outside version fingerprints and survives checkout", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const version = await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Before notes",
			}),
		);
		const beforeNote = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		const note = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Keep me outside versions",
			}),
		);
		expect(await Effect.runPromise(repository.readVersionStatusFx(project.projectId))).toEqual(
			beforeNote,
		);
		await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Changed after note",
					},
				},
			}),
		);
		await Effect.runPromise(
			repository.checkoutVersionFx({
				projectId: project.projectId,
				versionId: version.versionId,
			}),
		);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([
			note,
		]);
	});

	it("upgrades a v4 database without dropping its projects", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await harness.closeRepository(repository);
		const database = new DatabaseSync(harness.databasePath);
		database.exec("DROP TABLE project_notes; PRAGMA user_version = 4;");
		database.close();

		const upgraded = await harness.openRepository();
		expect(await Effect.runPromise(upgraded.readProjectFx(project.projectId))).toEqual(project);
		expect(await Effect.runPromise(upgraded.listNotesFx(project.projectId))).toEqual([]);
		const upgradedDatabase = new DatabaseSync(harness.databasePath);
		expect(upgradedDatabase.prepare("PRAGMA user_version").get()).toEqual({
			user_version: 5,
		});
		upgradedDatabase.close();
	});
});
