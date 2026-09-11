import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Effect, FileSystem, PlatformError } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-note-asset-links-");
});
afterEach(async () => harness.close());

describe("repository note asset relationships", () => {
	it("validates mixed links and rewrites only the affected resource relationship", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const hero = project.resources.find((resource) => resource.id === "hero");
		if (hero === undefined) throw new Error("Expected the hero fixture resource.");
		const prepared = await Effect.runPromise(
			repository.saveResourceFx({
				expectedRevision: project.revision,
				overwrite: false,
				projectId: project.projectId,
				resource: {
					...hero,
					id: "spare",
				},
			}),
		);
		const withCover = await Effect.runPromise(
			repository.saveResourceFx({
				expectedRevision: prepared.revision,
				overwrite: false,
				projectId: project.projectId,
				resource: {
					...hero,
					id: "cover",
				},
			}),
		);
		await Effect.runPromise(
			repository.saveResourceFx({
				expectedRevision: withCover.revision,
				overwrite: false,
				projectId: project.projectId,
				resource: {
					...hero,
					id: "future",
				},
			}),
		);
		for (const resourceIds of [
			[
				"hero",
				"hero",
			],
			[
				"missing",
			],
		]) {
			await expect(
				Effect.runPromise(
					repository.createNoteFx({
						projectId: project.projectId,
						content: "Rejected asset links",
						itemUids: [],
						resourceIds,
					}),
				),
			).rejects.toBeDefined();
		}
		const linked = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Shared art direction",
				itemUids: [
					"water",
				],
				resourceIds: [
					"hero",
					"cover",
					"future",
					"spare",
				],
			}),
		);
		const global = await Effect.runPromise(
			repository.createNoteFx({
				projectId: project.projectId,
				content: "Global",
				itemUids: [],
				resourceIds: [],
			}),
		);
		await expect(
			Effect.runPromise(
				repository.updateNoteFx({
					...linked,
					expectedUpdatedAtMs: linked.updatedAtMs,
					resourceIds: [
						"missing",
					],
				}),
			),
		).rejects.toBeDefined();
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Expected the project root.");
		await unlink(join(root, "assets", "cover.png"));
		await unlink(join(root, "assets", "future.png"));
		const restored = await Effect.runPromise(repository.refreshProjectFx(project.projectId));

		const renamed = await Effect.runPromise(
			repository.replaceResourceFx({
				config: {
					...restored.config,
					resources: {
						...restored.config.resources,
						hero: "cover",
					},
				},
				currentId: "hero",
				expectedRevision: restored.revision,
				projectId: project.projectId,
				resource: {
					...hero,
					id: "cover",
				},
			}),
		);
		const afterRename = (
			await Effect.runPromise(repository.listNotesFx(project.projectId))
		).find((note) => note.noteId === linked.noteId);
		expect(afterRename).toEqual({
			...linked,
			resourceIds: [
				"cover",
				"future",
				"spare",
			],
			updatedAtMs: expect.any(Number),
		});
		expect(afterRename!.updatedAtMs).toBeGreaterThan(global.updatedAtMs);

		await Effect.runPromise(
			repository.deleteResourceFx({
				expectedRevision: renamed.revision,
				projectId: project.projectId,
				resourceId: "spare",
			}),
		);
		const afterDelete = await Effect.runPromise(repository.listNotesFx(project.projectId));
		expect(afterDelete).toEqual([
			{
				...afterRename,
				resourceIds: [
					"cover",
					"future",
				],
				updatedAtMs: expect.any(Number),
			},
			global,
		]);
		expect(afterDelete[0]!.updatedAtMs).toBeGreaterThan(afterRename!.updatedAtMs);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual(
			afterDelete,
		);
	});

	it.each([
		"rename",
		"delete",
	] as const)("rolls back an asset %s when the second Note rewrite fails", async (operation) => {
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let fail = false;
		let publishedNotes = 0;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) => {
				if (
					fail &&
					basename(dirname(String(to))) === "notes" &&
					String(to).endsWith(".json")
				) {
					publishedNotes += 1;
					if (publishedNotes === 2) {
						fail = false;
						return Effect.fail(
							PlatformError.systemError({
								_tag: "Unknown",
								module: "FileSystem",
								method: "rename",
								description: "Injected second note publication failure",
							}),
						);
					}
				}
				return nodeFileSystem.rename(from, to);
			},
		};
		const repository = await harness.openRepository(fileSystem);
		const project = await harness.createProject(repository);
		const hero = project.resources.find((resource) => resource.id === "hero");
		if (hero === undefined) throw new Error("Expected the hero fixture resource.");
		const prepared =
			operation === "rename"
				? project
				: await Effect.runPromise(
						repository.saveResourceFx({
							expectedRevision: project.revision,
							overwrite: false,
							projectId: project.projectId,
							resource: {
								...hero,
								id: "spare",
							},
						}),
					);
		const linkedResourceId = operation === "rename" ? "hero" : "spare";
		for (const content of [
			"First retained note",
			"Second retained note",
		]) {
			await Effect.runPromise(
				repository.createNoteFx({
					projectId: project.projectId,
					content,
					itemUids: [],
					resourceIds: [
						linkedResourceId,
					],
				}),
			);
		}
		const beforeProject = await Effect.runPromise(repository.readProjectFx(project.projectId));
		const beforeNotes = await Effect.runPromise(repository.listNotesFx(project.projectId));
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		const beforeNoteBytes = await Promise.all(
			beforeNotes.map((note) =>
				readFile(join(root!, "notes", `${note.noteId}.json`), "utf8"),
			),
		);
		fail = true;
		const mutationFx =
			operation === "rename"
				? repository.replaceResourceFx({
						config: {
							...prepared.config,
							resources: {
								...prepared.config.resources,
								hero: "cover",
							},
						},
						currentId: "hero",
						expectedRevision: prepared.revision,
						projectId: project.projectId,
						resource: {
							...hero,
							id: "cover",
						},
					})
				: repository.deleteResourceFx({
						expectedRevision: prepared.revision,
						projectId: project.projectId,
						resourceId: "spare",
					});
		await expect(Effect.runPromise(mutationFx)).rejects.toBeDefined();
		expect(publishedNotes).toBe(2);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			beforeProject,
		);
		expect(await Effect.runPromise(repository.listNotesFx(project.projectId))).toEqual(
			beforeNotes,
		);
		expect(
			await Promise.all(
				beforeNotes.map((note) =>
					readFile(join(root!, "notes", `${note.noteId}.json`), "utf8"),
				),
			),
		).toEqual(beforeNoteBytes);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual(
			beforeProject,
		);
		expect(await Effect.runPromise(reopened.listNotesFx(project.projectId))).toEqual(
			beforeNotes,
		);
	});
});
