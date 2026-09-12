import { Effect } from "effect";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createTestPngBytes,
	createAlternateTestPngBytes,
} from "~/../test/arkpack-support/fn/createTestPngBytes";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { encodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/encodeArkpackEnvelopeFx";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-fs-project-build-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project build", () => {
	it("builds a fresh project directly", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-unversioned");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					expectedVersion: project.version,
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).resolves.toMatchObject({
			version: "1.0",
			revision: project.revision,
		});
	});

	it("builds saved project edits directly", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-dirty");
		const dirty = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Dirty title",
					},
				},
			}),
		);

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					expectedVersion: project.version,
					projectId: project.projectId,
					expectedRevision: dirty.revision,
				}),
			),
		).resolves.toMatchObject({
			version: "1.0",
			revision: dirty.revision,
		});
	});

	it("builds after replacing an early-sorting resource and adding an earlier asset without Refresh", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await Effect.runPromise(
			repository.replaceResourceFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				currentId: "hero",
				config: project.config,
				resource: {
					id: "hero",
					mime: "image/png",
					bytes: createAlternateTestPngBytes(),
				},
			}),
		);
		const updated = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "aa",
						mime: "image/png",
						bytes: createTestPngBytes(),
					},
				],
			}),
		);
		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: updated.revision,
					expectedVersion: updated.version,
				}),
			),
		).resolves.toMatchObject({
			revision: updated.revision,
			version: "1.0",
		});
		expect(updated.resources.map(({ id }) => id)).toEqual([
			"aa",
			"hero",
			"item-water",
		]);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(
			(await Effect.runPromise(reopened.readProjectFx(project.projectId)))?.resources,
		).toEqual(updated.resources);
	});

	it("publishes and reads the one canonical artifact while ignoring build output", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.build");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				expectedVersion: project.version,
				projectId: project.projectId,
				expectedRevision: project.revision,
			}),
		);

		expect(artifact).toMatchObject({
			projectId: "project.build",
			revision: project.revision,
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
			}),
		);
		expect(content.bytes.byteLength).toBe(artifact.size);
		await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Linked authoring notes stay outside gameplay artifacts",
				itemUids: [
					"water",
				],
				resourceIds: [],
			}),
		);
		const rebuilt = await Effect.runPromise(
			repository.buildProjectFx({
				expectedVersion: project.version,
				projectId: project.projectId,
				expectedRevision: project.revision,
			}),
		);
		expect(rebuilt.contentHash).toBe(artifact.contentHash);
		expect(await readFile(join(root, "build", "project%2Ebuild.arkpack"))).toEqual(
			Buffer.from(content.bytes),
		);
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
				expectedVersion: project.version,
				projectId: project.projectId,
				expectedRevision: project.revision,
			}),
		);
		const arkpackPath = join(root, "build", "project-tamper.arkpack");
		const envelope = Effect.runSync(
			decodeArkpackEnvelopeFx(new Uint8Array(await readFile(arkpackPath))),
		);
		const changedPayload = envelope.payload.slice();
		changedPayload[0] = (changedPayload[0] ?? 0) ^ 1;
		await writeFile(
			arkpackPath,
			Effect.runSync(
				encodeArkpackEnvelopeFx({
					payload: changedPayload,
					proof: envelope.proof,
				}),
			),
		);

		await expect(
			Effect.runPromise(
				repository.readProjectBuildFx({
					projectId: project.projectId,
					expectedRevision: artifact.revision,
					contentHash: artifact.contentHash,
				}),
			),
		).rejects.toMatchObject({
			operation: "read-project-build",
			cause: expect.objectContaining({
				message: "The current Editor build does not match the requested artifact.",
			}),
		});
		expect(await readFile(join(root, ".gitignore"), "utf8")).toBe(
			"custom-output/\n/build/\n/editor.lock\n",
		);
	});

	it("preserves blocking diagnostics with project-relative provenance", async () => {
		const root = await harness.createExternalProject("project-invalid-resource");
		await unlink(join(root, "assets", "item-water.png"));
		const repository = await harness.openRepository();
		const project = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					expectedVersion: project.version,
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			diagnostics: [
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
					source: "items/water.json",
				}),
			],
		});
	});

	it("keeps successful Build warnings project-relative", async () => {
		const root = await harness.createExternalProject("project-warning");
		await writeFile(join(root, "assets", "unused.png"), createTestPngBytes());
		const repository = await harness.openRepository();
		const project = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);

		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				expectedVersion: project.version,
				projectId: project.projectId,
				expectedRevision: project.revision,
			}),
		);

		expect(artifact.diagnostics).toContainEqual(
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ResourceUnused,
				source: "assets/unused.png",
			}),
		);
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
					expectedVersion: project.version,
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			message:
				"The saved project changed before the build snapshot could be published. Refresh the project and build again.",
		});
		await expect(readdir(join(root, "build"))).rejects.toBeDefined();
	});

	it("classifies structurally invalid external edits as requiring Refresh", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.invalid-external-change");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		await writeFile(join(root, "game.json"), "{ invalid json");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					expectedVersion: project.version,
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			message:
				"The saved project changed before the build snapshot could be published. Refresh the project and build again.",
		});
		await expect(readdir(join(root, "build"))).rejects.toBeDefined();
	});
});
