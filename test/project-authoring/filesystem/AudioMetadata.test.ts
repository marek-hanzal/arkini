import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-audio-metadata-");
});
afterEach(async () => harness.close());

describe("filesystem audio metadata", () => {
	it.each([
		"music",
		"sfx",
	] as const)(
		"saves and reopens %s names without reading audio or changing identity and references",
		async (type) => {
			const seeding = await harness.openRepository();
			const project = await harness.createProject(seeding);
			const source = join(harness.temporaryDirectory, "source.ogg");
			const bytes = createTestOggOpusBytesFn();
			await writeFile(source, bytes);
			const imported = await Effect.runPromise(
				seeding.upsertResourceFilesFx({
					projectId: project.projectId,
					resources: [
						{
							uid: "stable-audio",
							type,
							title: "Recording 17",
							path: source,
							size: bytes.byteLength,
						},
					],
				}),
			);
			const marked = await Effect.runPromise(
				seeding.replaceConfigFx({
					projectId: project.projectId,
					expectedRevision: imported.revision,
					config: {
						...imported.config,
						...(type === "music"
							? {
									items: Object.fromEntries(
										Object.entries(imported.config.items).map(([id, item]) => [
											id,
											{
												...item,
												music: "stable-audio",
											},
										]),
									),
									music: {
										playlist: [
											"stable-audio",
										],
									},
								}
							: {
									sfx: {
										events: {
											"job:started": "stable-audio",
										},
									},
								}),
					},
				}),
			);
			const note = await Effect.runPromise(
				seeding.createNoteFx({
					projectId: project.projectId,
					content: "Audio note",
					itemUids: [],
					resourceUids: [
						"stable-audio",
					],
				}),
			);
			const root = await Effect.runPromise(seeding.readProjectRootFx(project.projectId));
			if (root === null) throw new Error("Missing project root");
			await harness.closeRepository(seeding);
			const native = await Effect.runPromise(
				FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
			);
			const audioReads: string[] = [];
			const writes: string[] = [];
			const recordRead = (target: string) => {
				if (target.endsWith(".ogg")) audioReads.push(target);
			};
			const repository = await harness.openRepository({
				...native,
				readFile: (target) => {
					recordRead(target);
					return native.readFile(target);
				},
				readFileString: (target, encoding) => {
					recordRead(target);
					return native.readFileString(target, encoding);
				},
				stream: (target, options) => {
					recordRead(target);
					return native.stream(target, options);
				},
				writeFile: (target, data, options) => {
					writes.push(String(target));
					return native.writeFile(target, data, options);
				},
			});
			const opened = await Effect.runPromise(repository.readProjectFx(project.projectId));
			const original = opened?.resources.find(({ uid }) => uid === "stable-audio");
			expect(original).toMatchObject({
				title: "Recording 17",
			});
			writes.length = 0;
			const saved = await Effect.runPromise(
				repository.saveResourceMetadataFx({
					projectId: project.projectId,
					expectedRevision: marked.revision,
					resourceUid: "stable-audio",
					title: "  Dusty Plains  ",
				}),
			);
			expect(saved.resources.find(({ uid }) => uid === "stable-audio")).toEqual({
				...original,
				title: "Dusty Plains",
			});
			expect(saved.config).toEqual(marked.config);
			expect(saved.revision).toBeGreaterThan(marked.revision);
			expect(writes.sort()).toEqual(
				[
					join(root, type, "stable-audio.json"),
					join(root, "project.json"),
				].sort(),
			);
			expect(
				JSON.parse(await readFile(join(root, type, "stable-audio.json"), "utf8")),
			).toEqual({
				title: "Dusty Plains",
			});
			await expect(
				Effect.runPromise(
					repository.saveResourceMetadataFx({
						projectId: project.projectId,
						expectedRevision: marked.revision,
						resourceUid: "stable-audio",
						title: "Stale",
					}),
				),
			).rejects.toThrow("changed from revision");
			await expect(
				Effect.runPromise(
					repository.saveResourceMetadataFx({
						projectId: project.projectId,
						expectedRevision: saved.revision,
						resourceUid: "stable-audio",
						title: " ",
					}),
				),
			).rejects.toThrow("title is invalid");
			await expect(
				Effect.runPromise(
					repository.upsertResourceFilesFx({
						projectId: project.projectId,
						resources: [
							{
								uid: "stable-audio",
								type,
								title: "Collision",
								path: source,
								size: bytes.byteLength,
							},
						],
					}),
				),
			).rejects.toThrow("already exists");
			await expect(
				Effect.runPromise(
					repository.replaceResourceFx({
						projectId: project.projectId,
						expectedRevision: saved.revision,
						resourceUid: "stable-audio",
						resource: {
							uid: "new-id",
							title: "Renamed",
							type,
						},
					}),
				),
			).rejects.toThrow("preserve its resource UID and type");
			const reopened = await Effect.runPromise(
				repository.refreshProjectFx(project.projectId),
			);
			expect(reopened.resources.find(({ uid }) => uid === "stable-audio")).toEqual({
				...original,
				title: "Dusty Plains",
			});
			expect(
				(await Effect.runPromise(repository.listNotesFx(project.projectId))).find(
					({ noteId }) => noteId === note.noteId,
				)?.resourceUids,
			).toEqual([
				"stable-audio",
			]);
			expect(audioReads).toEqual([]);
			expect(await readFile(join(root, type, "stable-audio.ogg"))).toEqual(
				Buffer.from(bytes),
			);
			const deleted = await Effect.runPromise(
				repository.deleteResourceFx({
					projectId: project.projectId,
					expectedRevision: reopened.revision,
					resourceUid: "stable-audio",
				}),
			);
			expect(
				Object.values(deleted.config.items).every((item) => item.music === undefined),
			).toBe(true);
			expect(deleted.resources.some(({ uid }) => uid === "stable-audio")).toBe(false);
			for (const extension of [
				"ogg",
				"json",
			])
				await expect(
					readFile(join(root, type, `stable-audio.${extension}`)),
				).rejects.toMatchObject({
					code: "ENOENT",
				});
			expect(
				deleted.config.music?.playlist ?? Object.values(deleted.config.sfx?.events ?? {}),
			).toEqual([]);
			expect(
				(await Effect.runPromise(repository.listNotesFx(project.projectId))).find(
					({ noteId }) => noteId === note.noteId,
				)?.resourceUids,
			).toEqual([]);
		},
	);
});
