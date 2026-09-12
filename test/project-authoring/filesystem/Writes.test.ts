import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Cause, Effect, Exit, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
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
			if (
				target.startsWith(`${root}/`) &&
				target.endsWith(".json") &&
				!target.includes("editor.lock.write/")
			)
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
			rename: (from, to) => {
				if (String(from) === `${String(to)}.arkini-replace`)
					publishedTargets.add(String(to));
				return nodeFileSystem.rename(from, to);
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
					asset: {
						...water.asset,
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
		).toEqual(
			[
				...publishedTargets,
			].sort(),
		);
		const savedItem = JSON.parse(
			await Effect.runPromise(
				nodeFileSystem.readFileString(join(root, "items", `${water.uid}.json`)),
			),
		);
		expect(savedItem.item.asset.scale).toBe(0.65);
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
		).toEqual(
			[
				...publishedTargets,
			].sort(),
		);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		const project = await Effect.runPromise(reopened.readProjectFx(created.projectId));
		expect(project?.config.items.water?.asset.scale).toBe(0.65);
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
		).rejects.toThrow(`changed from revision ${compatible.revision} to ${itemCommit.revision}`);

		const resource = {
			id: "new-asset",
			mime: "image/png" as const,
			bytes: Uint8Array.of(7, 8, 9),
		};
		const resourceCommit = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: created.projectId,
				resources: [
					resource,
				],
			}),
		);
		expect(resourceCommit.resources.find(({ id }) => id === resource.id)).toEqual({
			id: resource.id,
			mime: resource.mime,
			size: resource.bytes.byteLength,
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
						...resource,
						bytes: Uint8Array.of(1),
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
						...resource,
						id: "hero",
					},
				}),
			),
		).rejects.toThrow("Resource ID hero already exists.");

		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(canonical?.config.items.water?.title).toBe("Fresh Water");
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		expect(new Uint8Array(await readFile(join(root, "assets", `${resource.id}.png`)))).toEqual(
			resource.bytes,
		);
		expect(canonical?.resources).toEqual(resourceCommit.resources);
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
