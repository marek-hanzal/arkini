import { Effect } from "effect";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createFilesystemEditorProjectTestHarness,
	type FilesystemEditorProjectTestHarness,
} from "./support/createFilesystemEditorProjectTestHarness";
import { TestArkpackSignKey } from "~test/support/arkpack/TestArkpackSigningIdentity";

let harness: FilesystemEditorProjectTestHarness;

beforeEach(async () => {
	harness = await createFilesystemEditorProjectTestHarness("arkini-fs-project-build-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project build", () => {
	it("publishes and reads the one canonical artifact while ignoring build output", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.build");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
			}),
		);

		expect(artifact).toMatchObject({
			projectId: "project.build",
			revision: project.revision,
			signed: false,
		});
		expect(await readdir(join(root, "build"))).toEqual([
			"project%2Ebuild.arkpack",
		]);
		expect(await readFile(join(root, ".gitignore"), "utf8")).toContain("/build/\n");
		const content = await Effect.runPromise(
			repository.readProjectBuildFx({
				projectId: project.projectId,
				expectedRevision: artifact.revision,
				contentHash: artifact.contentHash,
				signed: artifact.signed,
			}),
		);
		expect(content.bytes.byteLength).toBe(artifact.size);
		expect(content.signature).toBeUndefined();
	});

	it("rejects changed bytes and preserves a user's existing gitignore content", async () => {
		const root = await harness.createExternalProject("project-tamper");
		await writeFile(join(root, ".gitignore"), "custom-output/\n");
		const repository = await harness.openRepository();
		const project = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);
		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
			}),
		);
		await writeFile(
			join(root, "build", "project-tamper.arkpack"),
			new Uint8Array([
				1,
				2,
				3,
			]),
		);

		await expect(
			Effect.runPromise(
				repository.readProjectBuildFx({
					projectId: project.projectId,
					expectedRevision: artifact.revision,
					contentHash: artifact.contentHash,
					signed: artifact.signed,
				}),
			),
		).rejects.toMatchObject({
			operation: "read-project-build",
			cause: expect.objectContaining({
				message: "The current Editor build does not match the requested artifact.",
			}),
		});
		expect(await readFile(join(root, ".gitignore"), "utf8")).toBe("custom-output/\n/build/\n");
	});

	it("publishes and verifies a signed Editor build with this Arkini identity", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.signed");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				signKey: TestArkpackSignKey,
			}),
		);

		expect(artifact.signed).toBe(true);
		const content = await Effect.runPromise(
			repository.readProjectBuildFx({
				projectId: project.projectId,
				expectedRevision: artifact.revision,
				contentHash: artifact.contentHash,
				signed: artifact.signed,
			}),
		);
		expect(content.signature).toBeDefined();
		expect(await readdir(join(root, "build"))).toEqual([
			"project%2Esigned.arkpack",
			"project%2Esigned.arksig",
		]);
	});

	it("rejects unrefreshed external source changes before publishing", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.external-change");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const gamePath = join(root, "game.json");
		const source = JSON.parse(await readFile(gamePath, "utf8"));
		source.meta.title = "Externally changed without Refresh";
		await writeFile(gamePath, `${JSON.stringify(source, undefined, "\t")}\n`);

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			cause: expect.objectContaining({
				message:
					"Editor project files changed outside the Editor. Refresh before building.",
			}),
		});
		await expect(readdir(join(root, "build"))).rejects.toBeDefined();
	});
});
