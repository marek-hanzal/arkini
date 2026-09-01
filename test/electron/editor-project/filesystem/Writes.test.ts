import * as NodeServices from "@effect/platform-node/NodeServices";
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
	it("publishes an item update through only the changed item and project metadata files", async () => {
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
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) => {
				if (String(from) === `${String(to)}.arkini-replace`)
					publishedTargets.add(String(to));
				return nodeFileSystem.rename(from, to);
			},
		};
		const repository = await harness.openRepository(fileSystem);
		publishedTargets.clear();
		const water = created.config.items.water;
		await Effect.runPromise(
			repository.upsertItemFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				item: {
					...water,
					title: "Fresh Water",
				},
			}),
		);

		expect(
			[
				...publishedTargets,
			].sort(),
		).toEqual(
			[
				join(root, "game.json"),
				join(root, "items", "simple", `${water.uid}.json`),
				join(root, "project.json"),
			].sort(),
		);
	});

	it("pins config, item, and resource writes to the canonical revision and bumps compatibility", async () => {
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
		expect(compatible.version).toBe("1.1");
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
		expect(itemCommit.version).toBe("1.2");
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
			repository.saveResourceFx({
				projectId: created.projectId,
				expectedRevision: itemCommit.revision,
				overwrite: false,
				resource,
			}),
		);
		expect(resourceCommit.resources.find(({ id }) => id === resource.id)).toEqual(resource);
		expect(resourceCommit.version).toBe("1.3");
		await expect(
			Effect.runPromise(
				repository.saveResourceFx({
					projectId: created.projectId,
					expectedRevision: itemCommit.revision,
					overwrite: true,
					resource: {
						...resource,
						bytes: Uint8Array.of(1),
					},
				}),
			),
		).rejects.toThrow(
			`changed from revision ${itemCommit.revision} to ${resourceCommit.revision}`,
		);

		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(canonical?.config.items.water?.title).toBe("Fresh Water");
		expect(canonical?.resources.find(({ id }) => id === resource.id)?.bytes).toEqual(
			resource.bytes,
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
