import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "~test/project-authoring/filesystem/support/createProjectTestHarness";
import { createTestPngBytes } from "~test/serapack-support/fn/createTestPngBytes";

const execFileAsync = promisify(execFile);
let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-cli-pack-current-");
});

afterEach(async () => harness.close());

const runPack = (root: string, silent = false) =>
	execFileAsync(
		process.execPath,
		[
			"node_modules/tsx/dist/cli.mjs",
			"src/serakki-cli/serakki.ts",
			"game",
			"pack",
			root,
			...(silent
				? [
						"--silent",
					]
				: []),
		],
		{
			env: process.env,
		},
	);

const runValidate = (root: string, silent = false) =>
	execFileAsync(
		process.execPath,
		[
			"node_modules/tsx/dist/cli.mjs",
			"src/serakki-cli/serakki.ts",
			"game",
			"validate",
			root,
			...(silent
				? [
						"--silent",
					]
				: []),
		],
		{
			env: process.env,
		},
	);

describe("game pack CLI", () => {
	it("builds the current project directly before and after saved changes", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "cli-pack-head");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		await expect(runValidate(root)).resolves.toMatchObject({
			stdout: expect.stringContaining("Validated"),
		});

		const built = await runPack(root);
		expect(built.stdout).toContain("Building Serapack v1.0.");

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
		expect((await runPack(root)).stdout).toContain("Building Serapack v1.0.");
	}, 30_000);

	it("can suppress warning diagnostics without hiding validation success", async () => {
		const root = await harness.createExternalProject("cli-silent-warning");
		await writeFile(join(root, "artwork", "unused.png"), createTestPngBytes());
		await writeFile(
			join(root, "artwork", "unused.json"),
			JSON.stringify({
				title: "Unused",
			}),
		);

		const visible = await runValidate(root);
		expect(visible.stderr).toContain("WARNING resource:unused");
		expect(visible.stdout).toContain("Validated");

		const silent = await runValidate(root, true);
		expect(silent.stderr).not.toContain("WARNING resource:unused");
		expect(silent.stdout).toContain("Validated");

		const packed = await runPack(root, true);
		expect(packed.stderr).not.toContain("WARNING resource:unused");
		expect(packed.stdout).toContain("Building Serapack");
	}, 30_000);
});
