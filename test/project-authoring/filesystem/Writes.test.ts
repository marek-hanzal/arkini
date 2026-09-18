import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { Cause, Effect, Exit, FileSystem } from "effect";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-fs-writes-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project writes", () => {
	it("rekeys a renamed package while preserving its version and Notes", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await Effect.runPromise(
			repository.createNoteFx({
				itemUids: [],
				resourceIds: [],
				projectId: created.projectId,
				content: "Keep this note",
			}),
		);
		const renamed = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				config: {
					...created.config,
					meta: {
						...created.config.meta,
						id: "project-renamed",
					},
				},
			}),
		);

		expect(renamed).toMatchObject({
			projectId: "project-renamed",
			version: created.version,
		});
		expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).toBeNull();
		expect(await Effect.runPromise(repository.readProjectRootFx(created.projectId))).toBeNull();
		expect(await Effect.runPromise(repository.readProjectRootFx("project-renamed"))).toBe(root);
		expect(await Effect.runPromise(repository.listNotesFx("project-renamed"))).toEqual([
			expect.objectContaining({
				content: "Keep this note",
				itemUids: [],
				projectId: "project-renamed",
			}),
		]);

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx("project-renamed"))).toMatchObject({
			projectId: "project-renamed",
			version: created.version,
		});
	});

	it("rejects a project ID already owned by another open project", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		await harness.createProject(repository, "project-taken");

		await expect(
			Effect.runPromise(
				repository.replaceConfigFx({
					projectId: created.projectId,
					expectedRevision: created.revision,
					config: {
						...created.config,
						meta: {
							...created.config.meta,
							id: "project-taken",
						},
					},
				}),
			),
		).rejects.toThrow("Editor project ID project-taken is already open");
		expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).not.toBeNull();
	});

	it("saves item drafts and config without PNG I/O or reading unrelated JSON bodies", async () => {
		const seedingRepository = await harness.openRepository();
		const created = await harness.createProject(seedingRepository);
		const root = await Effect.runPromise(
			seedingRepository.readProjectRootFx(created.projectId),
		);
		if (root === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(seedingRepository);

		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const publishedTargets = new Set<string>();
		const pngOperations: string[] = [];
		const jsonReads = new Set<string>();
		const recordReadFn = (target: string) => {
			if (target.endsWith(".png")) pngOperations.push(target);
			if (target.startsWith(`${root}${sep}`) && target.endsWith(".json"))
				jsonReads.add(target);
		};
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			readFile: (target) => {
				recordReadFn(target);
				return nodeFileSystem.readFile(target);
			},
			readFileString: (target, encoding) => {
				recordReadFn(target);
				return nodeFileSystem.readFileString(target, encoding);
			},
			stat: (target) => {
				if (target.endsWith(".png")) pngOperations.push(target);
				return nodeFileSystem.stat(target);
			},
			writeFile: (target, bytes, options) => {
				publishedTargets.add(String(target));
				return nodeFileSystem.writeFile(target, bytes, options);
			},
		};
		const repository = await harness.openRepository(fileSystem);
		publishedTargets.clear();
		pngOperations.length = 0;
		jsonReads.clear();
		const water = created.config.items.water;
		const itemCommit = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				item: {
					...water,
					title: "Fresh Water",
					draft: true,
					artwork: {
						...water.artwork,
						scale: 0.65,
					},
				},
			}),
		);

		expect(
			[
				...publishedTargets,
			].sort(),
		).toEqual(
			[
				join(root, "items", `${water.uid}.json`),
				join(root, "project.json"),
			].sort(),
		);
		expect(pngOperations).toEqual([]);
		expect(
			[
				...jsonReads,
			].sort(),
		).toEqual([]);
		const savedItem = JSON.parse(
			await Effect.runPromise(
				nodeFileSystem.readFileString(join(root, "items", `${water.uid}.json`)),
			),
		);
		expect(savedItem.item.artwork.scale).toBe(0.65);
		expect(savedItem.item.draft).toBe(true);
		publishedTargets.clear();
		pngOperations.length = 0;
		jsonReads.clear();
		await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: created.projectId,
				expectedRevision: itemCommit.revision,
				config: {
					...itemCommit.config,
					meta: {
						...itemCommit.config.meta,
						title: "Renamed project",
					},
				},
			}),
		);
		expect(pngOperations).toEqual([]);
		expect(
			[
				...publishedTargets,
			].sort(),
		).toEqual(
			[
				join(root, "game.json"),
				join(root, "project.json"),
			].sort(),
		);
		expect(
			[
				...jsonReads,
			].sort(),
		).toEqual([]);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		const project = await Effect.runPromise(reopened.readProjectFx(created.projectId));
		expect(project?.config.items.water?.artwork.scale).toBe(0.65);
	});

	it("pins config, item, and resource writes while preserving the selected build version", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const compatible = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				config: {
					...created.config,
					$schema: "../schema.json",
					meta: {
						...created.config.meta,
						title: "Compatible title",
					},
				},
			}),
		);
		expect(compatible.version).toEqual({
			major: 1,
			minor: 0,
		});
		expect(compatible.config.$schema).toBe(GameProjectGameSchemaReference);

		const water = editorTestPayload.config.items.water;
		const itemCommit = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: created.projectId,
				expectedRevision: compatible.revision,
				item: {
					...water,
					title: "Fresh Water",
				},
			}),
		);
		expect(itemCommit.version).toEqual({
			major: 1,
			minor: 0,
		});
		await expect(
			Effect.runPromise(
				repository.upsertItemFx({
					projectId: created.projectId,
					expectedRevision: compatible.revision,
					item: {
						...water,
						description: "Stale replacement",
					},
				}),
			),
		).rejects.toMatchObject({
			reason: "revision-conflict",
			message: expect.stringContaining(
				`changed from revision ${compatible.revision} to ${itemCommit.revision}`,
			),
		});

		const resourceBytes = createTestPngBytes();
		const resourcePath = join(harness.temporaryDirectory, "new-artwork.png");
		await writeFile(resourcePath, resourceBytes);
		const resource = {
			id: "new-asset",
			type: "artwork" as const,
			path: resourcePath,
			size: resourceBytes.byteLength,
		};
		const resourceCommit = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: created.projectId,
				resources: [
					resource,
				],
			}),
		);
		expect(resourceCommit.resources.find(({ id }) => id === resource.id)).toEqual({
			id: resource.id,
			type: resource.type,
			size: resourceBytes.byteLength,
			version: expect.any(String),
		});
		expect(resourceCommit.version).toEqual({
			major: 1,
			minor: 0,
		});
		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: created.projectId,
					expectedRevision: itemCommit.revision,
					currentId: resource.id,
					config: resourceCommit.config,
					resource: {
						id: resource.id,
						type: resource.type,
					},
				}),
			),
		).rejects.toThrow(
			`changed from revision ${itemCommit.revision} to ${resourceCommit.revision}`,
		);

		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: created.projectId,
					expectedRevision: resourceCommit.revision,
					currentId: resource.id,
					config: resourceCommit.config,
					resource: {
						id: "hero",
						type: resource.type,
					},
				}),
			),
		).rejects.toThrow("Resource ID hero already exists.");

		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(canonical?.config.items.water?.title).toBe("Fresh Water");
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		expect(new Uint8Array(await readFile(join(root, "artwork", `${resource.id}.png`)))).toEqual(
			resourceBytes,
		);
		expect(canonical?.resources).toEqual(resourceCommit.resources);
	});

	it("validates a native replacement path as PNG before copying it", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		const original = await readFile(join(root, "image", "hero.png"));
		const source = join(harness.temporaryDirectory, "renamed-jpeg.png");
		await writeFile(source, "not a PNG");

		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					currentId: "hero",
					config: project.config,
					resource: {
						id: "hero",
						type: "image",
						path: source,
						size: 9,
					},
				}),
			),
		).rejects.toMatchObject({
			operation: "replace-resource",
		});
		expect(await readFile(join(root, "image", "hero.png"))).toEqual(original);
	});

	it("writes and reopens Music under its canonical Ogg path", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const source = join(harness.temporaryDirectory, "theme.ogg");
		const bytes = createTestOggOpusBytesFn();
		await writeFile(source, bytes);

		const committed = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "theme",
						path: source,
						size: bytes.byteLength,
						name: "Test audio",
						type: "music",
					},
				],
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		expect(await readFile(join(root, "music", "theme.ogg"))).toEqual(bytes);
		await harness.closeRepository(repository);

		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toMatchObject({
			resources: expect.arrayContaining([
				expect.objectContaining({
					id: "theme",
					size: bytes.byteLength,
					name: "Test audio",
					type: "music",
				}),
			]),
			revision: committed.revision,
		});
	});

	it("removes a deleted Music resource from the random playlist", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const source = join(harness.temporaryDirectory, "playlist-theme.ogg");
		const bytes = createTestOggOpusBytesFn();
		await writeFile(source, bytes);
		const imported = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "playlist-theme",
						path: source,
						size: bytes.byteLength,
						name: "Test audio",
						type: "music",
					},
				],
			}),
		);
		const marked = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: imported.revision,
				config: {
					...imported.config,
					music: {
						playlist: [
							"playlist-theme",
						],
					},
				},
			}),
		);
		const deleted = await Effect.runPromise(
			repository.deleteResourceFx({
				projectId: project.projectId,
				expectedRevision: marked.revision,
				resourceId: "playlist-theme",
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");

		expect(deleted.config.music?.playlist).toEqual([]);
		await expect(readFile(join(root, "music", "playlist-theme.ogg"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("removes a deleted SFX resource from every gameplay-event assignment", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const source = join(harness.temporaryDirectory, "shared-sfx.ogg");
		const bytes = createTestOggOpusBytesFn();
		await writeFile(source, bytes);
		const imported = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "shared-sfx",
						path: source,
						size: bytes.byteLength,
						name: "Test audio",
						type: "sfx",
					},
				],
			}),
		);
		const marked = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: imported.revision,
				config: {
					...imported.config,
					sfx: {
						events: {
							"job:started": "shared-sfx",
							"item:spawned": "shared-sfx",
						},
					},
				},
			}),
		);
		const deleted = await Effect.runPromise(
			repository.deleteResourceFx({
				projectId: project.projectId,
				expectedRevision: marked.revision,
				resourceId: "shared-sfx",
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");

		expect(deleted.config.sfx?.events).toEqual({});
		await expect(readFile(join(root, "sfx", "shared-sfx.ogg"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("rejects non-square Artwork replacement without changing the source", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		const target = join(root, "artwork", "item-water.png");
		const original = await readFile(target);
		const source = join(harness.temporaryDirectory, "rectangular-artwork.png");
		await sharp({
			create: {
				width: 3,
				height: 2,
				channels: 4,
				background: {
					r: 255,
					g: 0,
					b: 255,
					alpha: 1,
				},
			},
		})
			.png()
			.toFile(source);

		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					currentId: "item-water",
					config: project.config,
					resource: {
						id: "item-water",
						type: "artwork",
						path: source,
						size: 1,
					},
				}),
			),
		).rejects.toMatchObject({
			operation: "replace-resource",
		});
		expect(await readFile(target)).toEqual(original);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
	});

	it("returns a typed repository failure when a write targets an unknown project", async () => {
		const repository = await harness.openRepository();
		const result = await Effect.runPromiseExit(
			repository.upsertItemFx({
				projectId: "missing-project",
				item: editorTestPayload.config.items.water,
			}),
		);
		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isSuccess(result)) throw new Error("Expected a typed repository failure.");
		expect(Cause.hasDies(result.cause)).toBe(false);
		expect(Cause.squash(result.cause)).toMatchObject({
			_tag: "EditorProjectRepositoryError",
		});
	});
});
