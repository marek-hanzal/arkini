import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "~test/project-authoring/filesystem/support/createProjectTestHarness";
import { readCommittedProjectHeadFx } from "~/project-version/fx/readCommittedProjectHeadFx";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-committed-head-");
});

afterEach(async () => harness.close());

describe("readCommittedProjectHeadFx", () => {
	it("admits only the exact clean Version HEAD", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "portable-head");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const readHead = () =>
			Effect.runPromise(
				readCommittedProjectHeadFx(root).pipe(Effect.provide(NodeServices.layer)),
			);

		await expect(readHead()).rejects.toThrow(
			"Commit the initial project version before building.",
		);
		const initialStatus = await Effect.runPromise(
			repository.readVersionStatusFx(project.projectId),
		);
		const initial = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: initialStatus.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);
		await expect(readHead()).resolves.toEqual({
			version: "1.0",
			versionId: initial.versionId,
		});

		await Effect.runPromise(
			repository.replaceConfigFx({
				config: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Dirty",
					},
				},
				expectedRevision: project.revision,
				projectId: project.projectId,
			}),
		);
		await expect(readHead()).rejects.toThrow(
			"Commit the saved project changes before building.",
		);
	});

	it("rejects a published HEAD with a corrupted non-scenario object", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "corrupted-portable-head");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const status = await Effect.runPromise(repository.readVersionStatusFx(project.projectId));
		const initial = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: status.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);
		const manifest = JSON.parse(
			await readFile(join(root, "versions", initial.versionId, "manifest.json"), "utf8"),
		) as {
			readonly game: string;
		};
		await writeFile(join(root, "objects", `${manifest.game}.json`), "corrupt\n");

		await expect(
			Effect.runPromise(
				readCommittedProjectHeadFx(root).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toThrow("failed its content hash check");
	});
});
