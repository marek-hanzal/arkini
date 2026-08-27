import { access, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
	createFilesystemEditorProjectTestHarness,
	type FilesystemEditorProjectTestHarness,
} from "./support/createFilesystemEditorProjectTestHarness";

let harness: FilesystemEditorProjectTestHarness | undefined;

afterEach(async () => {
	await harness?.close();
	harness = undefined;
});

describe("filesystem Editor project admission", () => {
	it("keeps healthy projects available while a malformed catalog rebuild preserves an invalid root", async () => {
		harness = await createFilesystemEditorProjectTestHarness("arkini-project-admission-");
		const repository = await harness.openRepository();
		const healthy = await harness.createProject(repository, "healthy-project");
		const broken = await harness.createProject(repository, "broken-project");
		const healthyRoot = await Effect.runPromise(
			repository.readProjectRootFx(healthy.projectId),
		);
		const brokenRoot = await Effect.runPromise(repository.readProjectRootFx(broken.projectId));
		if (healthyRoot === null || brokenRoot === null) throw new Error("Managed root missing.");
		await harness.closeRepository(repository);
		const brokenFile = join(brokenRoot, "game.json");
		await writeFile(brokenFile, "{broken");
		const externalRoot = await harness.createExternalProject("forgotten-external");
		await writeFile(
			harness.catalogPath,
			JSON.stringify({
				projects: [
					{
						root: externalRoot,
						ownership: "external",
						createdAtMs: 1,
					},
				],
				unexpected: true,
			}),
		);

		const reopened = await harness.openRepository();
		const candidates = await Effect.runPromise(reopened.listProjectsFx);
		expect(candidates).toHaveLength(2);
		expect(candidates.find((candidate) => candidate.type === "valid")).toMatchObject({
			type: "valid",
			project: {
				projectId: healthy.projectId,
			},
		});
		expect(candidates.find((candidate) => candidate.type === "invalid")).toMatchObject({
			type: "invalid",
			root: brokenRoot,
			validationError: expect.stringContaining(brokenFile),
		});
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toEqual({
			projects: [
				brokenRoot,
				healthyRoot,
			]
				.sort()
				.map((root) => ({
					root,
					ownership: "managed",
					createdAtMs: 0,
				})),
		});
		await expect(access(brokenRoot)).resolves.toBeUndefined();
	});

	it("reconciles healthy and invalid managed roots missing from a valid catalog", async () => {
		harness = await createFilesystemEditorProjectTestHarness("arkini-project-reconcile-");
		const repository = await harness.openRepository();
		const listed = await harness.createProject(repository, "listed-project");
		const unlisted = await harness.createProject(repository, "unlisted-project");
		const broken = await harness.createProject(repository, "broken-unlisted-project");
		const externalRoot = await harness.createExternalProject("external-project");
		const canonicalExternalRoot = await realpath(externalRoot);
		const external = await Effect.runPromise(
			repository.openProjectFx({
				root: externalRoot,
			}),
		);
		const roots = await Promise.all(
			[
				listed,
				unlisted,
				broken,
			].map(({ projectId }) => Effect.runPromise(repository.readProjectRootFx(projectId))),
		);
		const [listedRoot, unlistedRoot, brokenRoot] = roots;
		if (listedRoot === null || unlistedRoot === null || brokenRoot === null)
			throw new Error("Managed root missing.");
		const stored = JSON.parse(await readFile(harness.catalogPath, "utf8")) as {
			readonly projects: ReadonlyArray<{
				readonly root: string;
				readonly ownership: "external" | "managed";
				readonly createdAtMs: number;
			}>;
		};
		await harness.closeRepository(repository);
		const brokenFile = join(brokenRoot, "game.json");
		await writeFile(brokenFile, "{broken");
		await writeFile(
			harness.catalogPath,
			JSON.stringify({
				projects: stored.projects.filter(
					(entry) => entry.root === listedRoot || entry.root === canonicalExternalRoot,
				),
			}),
		);

		const reopened = await harness.openRepository();
		const candidates = await Effect.runPromise(reopened.listProjectsFx);
		expect(
			candidates
				.flatMap((candidate) =>
					candidate.type === "valid"
						? [
								candidate.project.projectId,
							]
						: [],
				)
				.sort(),
		).toEqual(
			[
				external.projectId,
				listed.projectId,
				unlisted.projectId,
			].sort(),
		);
		expect(candidates.find((candidate) => candidate.type === "invalid")).toMatchObject({
			type: "invalid",
			root: brokenRoot,
			validationError: expect.stringContaining(brokenFile),
		});
		expect(
			(JSON.parse(await readFile(harness.catalogPath, "utf8")) as typeof stored).projects.map(
				(entry) => entry.root,
			),
		).toEqual([
			...[
				listedRoot,
				unlistedRoot,
				brokenRoot,
			].sort(),
			canonicalExternalRoot,
		]);
		await expect(access(brokenRoot)).resolves.toBeUndefined();
	});

	it("admits a repaired invalid sidecar on the next project-list refresh", async () => {
		harness = await createFilesystemEditorProjectTestHarness("arkini-project-refresh-");
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "repairable-project");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed root missing.");
		await harness.closeRepository(repository);
		const note = join(root, "notes", "broken.json");
		await mkdir(join(root, "notes"), {
			recursive: true,
		});
		await writeFile(note, "{broken");

		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([
			expect.objectContaining({
				type: "invalid",
				root,
				validationError: expect.stringContaining(note),
			}),
		]);
		await rm(note);
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([
			expect.objectContaining({
				type: "valid",
				project: expect.objectContaining({
					projectId: project.projectId,
				}),
			}),
		]);
		expect(
			(await Effect.runPromise(reopened.readProjectFx(project.projectId)))?.projectId,
		).toBe(project.projectId);
	});

	it("rejects an external project whose sidecars fail complete validation", async () => {
		harness = await createFilesystemEditorProjectTestHarness("arkini-project-external-");
		const root = await harness.createExternalProject("invalid-external");
		const note = join(root, "notes", "broken.json");
		await mkdir(join(root, "notes"), {
			recursive: true,
		});
		await writeFile(note, "{broken");
		const repository = await harness.openRepository();

		await expect(
			Effect.runPromise(
				repository.openProjectFx({
					root,
				}),
			),
		).rejects.toThrow("could not be opened");
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toEqual({
			projects: [],
		});
	});
});
