import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Effect, FileSystem, PlatformError } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-build-version-");
});
afterEach(async () => harness.close());

describe("filesystem build version metadata", () => {
	it("persists only game.json and survives reopen without changing authoring revision or Notes", async () => {
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const published: Array<string> = [];
		const repository = await harness.openRepository({
			...nodeFileSystem,
			rename: (from, to) => {
				if (String(from) === `${String(to)}.arkini-replace`) published.push(String(to));
				return nodeFileSystem.rename(from, to);
			},
		});
		const project = await harness.createProject(repository);
		const note = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Keep",
				itemUids: [],
				resourceIds: [],
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Missing root.");
		const marker = await readFile(join(root, "project.json"));
		published.length = 0;
		const version = {
			major: 3,
			minor: 7,
			suffix: "candidate",
		};
		const saved = await Effect.runPromise(
			repository.saveBuildVersionFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				version,
			}),
		);
		expect(saved).toEqual(version);
		expect(published).toEqual([
			join(root, "game.json"),
		]);
		expect(await readFile(join(root, "project.json"))).toEqual(marker);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual({
			...project,
			version,
		});
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual([
			note,
		]);
		await Effect.runPromise(
			repository.saveBuildVersionFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				version,
			}),
		);
		expect(published).toEqual([
			join(root, "game.json"),
		]);
		saved.major = 90;
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.version,
		).toEqual(version);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual({
			...project,
			version,
		});
		const build = await Effect.runPromise(
			reopened.buildProjectFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				expectedVersion: version,
			}),
		);
		expect(build).toMatchObject({
			revision: project.revision,
			version: "3.7-candidate",
		});
	});

	it("rejects a stale authoring revision and an intervening same-revision version selection", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await expect(
			Effect.runPromise(
				repository.saveBuildVersionFx({
					projectId: project.projectId,
					expectedRevision: project.revision - 1,
					version: {
						major: 8,
						minor: 0,
					},
				}),
			),
		).rejects.toMatchObject({
			operation: "save-build-version",
		});
		await Effect.runPromise(
			repository.saveBuildVersionFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				version: {
					major: 2,
					minor: 0,
				},
			}),
		);
		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					expectedVersion: project.version,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			message: expect.stringContaining("selected build version changed"),
		});
	});

	it("rejects unrefreshed source changes before replacing version metadata", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Missing root.");
		const target = join(root, "game.json");
		const game = JSON.parse(await readFile(target, "utf8"));
		const external = JSON.stringify({
			...game,
			meta: {
				...game.meta,
				title: "External title",
			},
		});
		await writeFile(target, external);
		await expect(
			Effect.runPromise(
				repository.saveBuildVersionFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					version: {
						major: 2,
						minor: 0,
					},
				}),
			),
		).rejects.toMatchObject({
			operation: "save-build-version",
		});
		expect(await readFile(target, "utf8")).toBe(external);
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.version,
		).toEqual(project.version);
	});

	it("rolls back a failed version write before publishing repository state", async () => {
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let fail = false;
		const repository = await harness.openRepository({
			...nodeFileSystem,
			rename: (from, to) => {
				if (
					fail &&
					String(from) === `${String(to)}.arkini-replace` &&
					basename(String(to)) === "game.json"
				) {
					fail = false;
					return Effect.fail(
						PlatformError.systemError({
							_tag: "Unknown",
							module: "FileSystem",
							method: "rename",
							description: "Injected version publication failure",
						}),
					);
				}
				return nodeFileSystem.rename(from, to);
			},
		});
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Missing root.");
		const before = await readFile(join(root, "game.json"));
		fail = true;
		await expect(
			Effect.runPromise(
				repository.saveBuildVersionFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					version: {
						major: 2,
						minor: 0,
					},
				}),
			),
		).rejects.toMatchObject({
			operation: "save-build-version",
		});
		expect(await readFile(join(root, "game.json"))).toEqual(before);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual(project);
	});
});
