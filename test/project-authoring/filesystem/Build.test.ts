import { Effect } from "effect";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createTestPngBytes,
	createAlternateTestPngBytes,
} from "~/../test/serapack-support/fn/createTestPngBytes";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";
import { decodeTestSerapackEnvelopeFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { decodeTestSerapackPayloadFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { encodeTestSerapackEnvelopeFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { createFreshProjectFx } from "~/project-authoring/fx/createFreshProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-fs-project-build-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project build", () => {
	it("builds a newly created empty project before its first Editor build", async () => {
		const repository = await harness.openRepository();
		const project = await Effect.runPromise(
			createFreshProjectFx("fresh-game").pipe(
				Effect.provideService(ProjectRepository, repository),
			),
		);
		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
				}),
			),
		).resolves.toMatchObject({
			projectId: project.projectId,
			revision: project.revision,
		});
	});

	it("builds a fresh project directly", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-unversioned");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
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
					projectId: project.projectId,
				}),
			),
		).resolves.toMatchObject({
			version: "1.0",
			revision: dirty.revision,
		});
	});

	it("builds an item edit without refreshing the Editor project", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project-item-edit");
		const water = project.config.items.water;
		const commit = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				item: {
					...water,
					title: "Fresh Water",
				},
			}),
		);
		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
				}),
			),
		).resolves.toMatchObject({
			revision: commit.revision,
		});
	});

	it("builds after replacing an early-sorting resource and adding earlier Artwork without Refresh", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const alternateHero = createAlternateTestPngBytes();
		const alternateHeroPath = join(harness.temporaryDirectory, "alternate-hero.png");
		const artwork = createTestPngBytes();
		const artworkPath = join(harness.temporaryDirectory, "aa.png");
		await Promise.all([
			writeFile(alternateHeroPath, alternateHero),
			writeFile(artworkPath, artwork),
		]);
		await Effect.runPromise(
			repository.replaceResourceFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				currentId: "hero",
				config: project.config,
				resource: {
					id: "hero",
					type: "image",
					path: alternateHeroPath,
					size: alternateHero.byteLength,
				},
			}),
		);
		const updated = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "aa",
						type: "artwork",
						path: artworkPath,
						size: artwork.byteLength,
					},
				],
			}),
		);
		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
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
				projectId: project.projectId,
			}),
		);

		expect(artifact).toMatchObject({
			projectId: "project.build",
			revision: project.revision,
		});
		expect(await readdir(join(root, "build"))).toEqual([
			"project%2Ebuild.serapack",
		]);
		expect(await readFile(join(root, ".gitignore"), "utf8")).toContain("/build/\n");
		const content = await Effect.runPromise(
			repository.withProjectBuildPathFx(
				{
					projectId: project.projectId,
					expectedRevision: artifact.revision,
					contentHash: artifact.contentHash,
				},
				(path) => Effect.promise(() => readFile(path)),
			),
		);
		expect(content.byteLength).toBe(artifact.size);
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
				projectId: project.projectId,
			}),
		);
		expect(rebuilt.contentHash).toBe(artifact.contentHash);
		expect(await readFile(join(root, "build", "project%2Ebuild.serapack"))).toEqual(content);
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
			}),
		);
		const serapackPath = join(root, "build", "project-tamper.serapack");
		const envelope = Effect.runSync(
			decodeTestSerapackEnvelopeFx(new Uint8Array(await readFile(serapackPath))),
		);
		const changedPayload = envelope.payload.slice();
		changedPayload[changedPayload.byteLength - 1] =
			(changedPayload[changedPayload.byteLength - 1] ?? 0) ^ 1;
		await writeFile(
			serapackPath,
			Effect.runSync(
				encodeTestSerapackEnvelopeFx({
					payload: changedPayload,
					proof: envelope.proof,
				}),
			),
		);

		await expect(
			Effect.runPromise(
				repository.withProjectBuildPathFx(
					{
						projectId: project.projectId,
						expectedRevision: artifact.revision,
						contentHash: artifact.contentHash,
					},
					() => Effect.void,
				),
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
		await unlink(join(root, "artwork", "item-water.png"));
		const repository = await harness.openRepository();
		const project = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
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
		await writeFile(join(root, "artwork", "unused.png"), createTestPngBytes());
		const repository = await harness.openRepository();
		const project = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);

		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				projectId: project.projectId,
			}),
		);

		expect(artifact.diagnostics).toContainEqual(
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ResourceUnused,
				source: "artwork/unused.png",
			}),
		);
	});

	it("builds the saved source even when the mounted Editor projection differs", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.external-change");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		const gamePath = join(root, "game.json");
		const source = JSON.parse(await readFile(gamePath, "utf8"));
		source.meta.title = "Current saved title";
		await writeFile(gamePath, `${JSON.stringify(source, undefined, "\t")}\n`);
		const markerPath = join(root, "project.json");
		const marker = JSON.parse(await readFile(markerPath, "utf8"));
		await writeFile(
			markerPath,
			`${JSON.stringify({
				...marker,
				revision: project.revision + 1,
			})}\n`,
		);

		const artifact = await Effect.runPromise(
			repository.buildProjectFx({
				projectId: project.projectId,
			}),
		);
		const envelope = Effect.runSync(
			decodeTestSerapackEnvelopeFx(
				new Uint8Array(
					await readFile(join(root, "build", "project%2Eexternal-change.serapack")),
				),
			),
		);
		const payload = Effect.runSync(decodeTestSerapackPayloadFx(envelope.payload));
		expect(payload.config.meta.title).toBe("Current saved title");
		expect(artifact.revision).toBe(project.revision + 1);
		await expect(
			Effect.runPromise(
				repository.withProjectBuildPathFx(
					{
						projectId: project.projectId,
						expectedRevision: artifact.revision,
						contentHash: artifact.contentHash,
					},
					(path) => Effect.promise(() => readFile(path)),
				),
			),
		).resolves.toHaveLength(artifact.size);
	});

	it("rejects structurally invalid saved source through compilation", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository, "project.invalid-external-change");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root is missing.");
		await writeFile(join(root, "game.json"), "{ invalid json");

		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
				}),
			),
		).rejects.toMatchObject({
			operation: "build-project",
		});
		await expect(readdir(join(root, "build"))).rejects.toBeDefined();
	});
});
