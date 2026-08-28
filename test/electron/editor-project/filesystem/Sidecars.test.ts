import { Buffer } from "node:buffer";
import { readFile, readdir, writeFile } from "node:fs/promises";
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
	it("caches portable notes and scenarios until Refresh, then drops scenarios on a major commit", async () => {
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
		expect(breaking.version).toBe("2.0");
		expect(await Effect.runPromise(repository.listBoardScenariosFx(project.projectId))).toEqual(
			[],
		);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toHaveLength(1);
	});
});
