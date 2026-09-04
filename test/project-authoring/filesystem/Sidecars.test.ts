import { Buffer } from "node:buffer";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
				projectId: project.projectId,
				content: "Original note",
			}),
		);
		const updated = await Effect.runPromise(
			repository.updateNoteFx({
				projectId: project.projectId,
				noteId: created.noteId,
				content: "Current note",
				expectedUpdatedAtMs: created.updatedAtMs,
			}),
		);

		await expect(
			Effect.runPromise(
				repository.updateNoteFx({
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
		expect(
			(await Effect.runPromise(repository.listNotesFx(project.projectId))).map(
				(note) => note.noteId,
			),
		).toEqual([
			"\udc00",
			"\ud800",
		]);

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(
			(await Effect.runPromise(reopened.listNotesFx(project.projectId))).map(
				(note) => note.noteId,
			),
		).toEqual([
			"\udc00",
			"\ud800",
		]);
	});

	it("caches sidecars until Refresh and deletes current scenarios on a major Version commit", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Expected the managed project root.");
		const note = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Editor-owned note",
			}),
		);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Opening",
				bytes: Uint8Array.of(1, 2),
			}),
		);
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.revision,
		).toBe(project.revision);

		const notePath = join(root, "notes", `${note.noteId}.json`);
		const noteFile = JSON.parse(await readFile(notePath, "utf8")) as {
			content: string;
			updatedAtMs: number;
		};
		noteFile.content = "Changed on disk";
		noteFile.updatedAtMs += 1;
		await writeFile(notePath, `${JSON.stringify(noteFile, null, "\t")}\n`);

		const [scenarioName] = await readdir(join(root, "scenarios"));
		if (scenarioName === undefined) throw new Error("Expected a scenario file.");
		const scenarioPath = join(root, "scenarios", scenarioName);
		const scenarioFile = JSON.parse(await readFile(scenarioPath, "utf8")) as {
			save: string;
			updatedAtMs: number;
		};
		scenarioFile.save = Buffer.from(Uint8Array.of(9)).toString("base64");
		scenarioFile.updatedAtMs += 1;
		await writeFile(scenarioPath, `${JSON.stringify(scenarioFile, null, "\t")}\n`);

		expect(
			(await Effect.runPromise(repository.listNotesFx(project.projectId)))[0]?.content,
		).toBe("Editor-owned note");
		expect(
			(
				await Effect.runPromise(
					repository.readBoardScenarioFx({
						projectId: project.projectId,
						name: "Opening",
					}),
				)
			)?.bytes,
		).toEqual(Uint8Array.of(1, 2));

		const refreshed = await Effect.runPromise(repository.refreshProjectFx(project.projectId));
		expect(
			(await Effect.runPromise(repository.listNotesFx(project.projectId)))[0]?.content,
		).toBe("Changed on disk");
		expect(
			(
				await Effect.runPromise(
					repository.readBoardScenarioFx({
						projectId: project.projectId,
						name: "Opening",
					}),
				)
			)?.bytes,
		).toEqual(Uint8Array.of(9));
		const initialStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: initialStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);

		const breaking = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: refreshed.revision,
				config: {
					...refreshed.config,
					items: {},
				},
			}),
		);
		expect(breaking.version).toBe("1.0");
		expect(
			await Effect.runPromise(repository.listBoardScenariosFx(project.projectId)),
		).toHaveLength(1);
		expect(
			(
				await Effect.runPromise(
					repository.readBoardScenarioFx({
						projectId: project.projectId,
						name: "Opening",
					}),
				)
			)?.bytes,
		).toEqual(Uint8Array.of(9));
		const preview = await Effect.runPromise(
			repository.previewVersionCommitFx(project.projectId),
		);
		expect(preview).toMatchObject({
			bump: "major",
			nextArkpackVersion: "2.0",
			scenariosToDelete: [
				"Opening",
			],
		});
		const committed = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: preview.currentFingerprint,
				projectId: project.projectId,
				subject: "Remove the item",
			}),
		);
		expect(committed.arkpackVersion).toBe("2.0");
		expect(
			await Effect.runPromise(repository.listBoardScenariosFx(project.projectId)),
		).toHaveLength(0);
		await expect(readFile(scenarioPath, "utf8")).rejects.toMatchObject({
			code: "ENOENT",
		});
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toHaveLength(1);
	});
});
