import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "~test/project-authoring/filesystem/support/createProjectTestHarness";

const execFileAsync = promisify(execFile);
let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-cli-pack-head-");
});

afterEach(async () => harness.close());

const runPack = (root: string) =>
	execFileAsync(
		process.execPath,
		[
			"node_modules/tsx/dist/cli.mjs",
			"src/arkini-cli/arkini.ts",
			"game",
			"pack",
			root,
		],
		{
			env: process.env,
		},
	);

const runValidate = (root: string) =>
	execFileAsync(
		process.execPath,
		[
			"node_modules/tsx/dist/cli.mjs",
			"src/arkini-cli/arkini.ts",
			"game",
			"validate",
			root,
		],
		{
			env: process.env,
		},
	);

describe("game pack CLI", () => {
	it("builds the exact clean Version HEAD and rejects later saved changes", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "cli-pack-head");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		await expect(runValidate(root)).resolves.toMatchObject({
			stdout: expect.stringContaining("Validated"),
		});
		const status = await Effect.runPromise(repository.readVersionStatusFx(project.projectId));
		const version = await Effect.runPromise(
			repository.createVersionFx({
				expectedFingerprint: status.currentFingerprint,
				projectId: project.projectId,
				subject: "Initial",
			}),
		);

		const built = await runPack(root);
		expect(built.stdout).toContain(
			`Building Version HEAD ${version.versionId} (Arkpack v1.0).`,
		);

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
		const rejected = await runPack(root).catch(
			(cause: unknown) =>
				cause as {
					readonly stderr: string;
					readonly stdout: string;
				},
		);
		expect(`${rejected.stdout}${rejected.stderr}`).toContain(
			"Commit the saved project changes before building.",
		);
	}, 30_000);
});
