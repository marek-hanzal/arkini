import { Effect } from "effect";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestPngBytes } from "~/../test/arkpack-support/fn/createTestPngBytes";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { encodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/encodeArkpackEnvelopeFx";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-fs-project-build-");
});

afterEach(async () => harness.close());

const commitCurrent = async (repository: OwnedEditorProjectRepository, projectId: string) => {
	const status = await Effect.runPromise(repository.readVersionStatusFx(projectId));
	await Effect.runPromise(
		repository.createVersionFx({
			expectedFingerprint: status.currentFingerprint,
			projectId,
			subject: "Initial",
		}),
	);
};

describe("filesystem Editor project build", () => {
	it("requires a committed Version HEAD", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-unversioned");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			message: "Commit the initial project version before building.",
		});
	});

	it("rejects saved working-copy changes until they are committed", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-dirty");
		await commitCurrent(repository, project.projectId);
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
					projectId: project.projectId,
					expectedRevision: dirty.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			message: "Commit the saved project changes before building.",
		});
	});

	it("rejects a corrupted published Version HEAD object", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-corrupt-head");
		await commitCurrent(repository, project.projectId);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const head = JSON.parse(await readFile(join(root, "versions", "head.json"), "utf8")) as {
			readonly current: string;
		};
		const manifest = JSON.parse(
			await readFile(join(root, "versions", head.current, "manifest.json"), "utf8"),
		) as {
			readonly game: string;
		};
		await writeFile(join(root, "objects", `${manifest.game}.json`), "corrupt\n");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			message: "The published Version HEAD is invalid.",
		});
	});

	it("publishes and reads the one canonical artifact while ignoring build output", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.build");
		await commitCurrent(repository, project.projectId);
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
		await commitCurrent(repository, project.projectId);
		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
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
		await commitCurrent(repository, project.projectId);

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
			diagnostics: [
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ResourceMissing,
					source: "items/simple/water.json",
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
		await commitCurrent(repository, project.projectId);

		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
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
		await commitCurrent(repository, project.projectId);
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
			message:
				"The saved project changed before the build snapshot could be published. Refresh the project and build again.",
		});
		await expect(readdir(join(root, "build"))).rejects.toBeDefined();
	});

	it("classifies structurally invalid external edits as requiring Refresh", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.invalid-external-change");
		await commitCurrent(repository, project.projectId);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		await writeFile(join(root, "game.json"), "{ invalid json");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
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
