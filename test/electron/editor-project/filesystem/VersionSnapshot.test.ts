import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createProjectPathsFx } from "../../../../electron/main/editor-project/filesystem/createProjectPathsFx";
import { createVersionSnapshotFx } from "../../../../electron/main/editor-project/filesystem/fx/createVersionSnapshotFx";
import { readVersionSnapshotFx } from "../../../../electron/main/editor-project/filesystem/fx/readVersionSnapshotFx";
import { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";
import { GameProjectGameSchemaReference } from "~/game-config/source/GameProjectReference";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const writeSnapshotFx = (props: Omit<createVersionSnapshotFx.Props, "filesystemWrite">) =>
	Effect.gen(function* () {
		const filesystemWrite = yield* createFilesystemWriteFx();
		return yield* createVersionSnapshotFx({
			...props,
			filesystemWrite,
		});
	});

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-version-objects-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("filesystem Editor version objects", () => {
	it("round-trips one full snapshot, deduplicates valid objects, and rejects corruption", async () => {
		const scenario = EditorBoardScenarioSchema.parse({
			projectId: "editor-test",
			name: "Opening",
			projectRevision: 3,
			version: "1.0",
			bytes: Uint8Array.of(7, 8),
			createdAtMs: 10,
			updatedAtMs: 11,
		});
		const { paths, snapshot } = await Effect.runPromise(
			Effect.gen(function* () {
				const paths = yield* createProjectPathsFx(root);
				const snapshot = yield* writeSnapshotFx({
					arkpack: editorTestPayload.version,
					config: editorTestPayload.config,
					resources: editorTestPayload.resources,
					scenarios: [
						scenario,
					],
					paths,
				});
				return {
					paths,
					snapshot,
				};
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(snapshot.manifest).toMatchObject({
			items: {
				water: expect.stringMatching(/^[a-f0-9]{64}$/),
			},
			assets: {
				"item-water": expect.stringMatching(/^[a-f0-9]{64}$/),
			},
			resources: {
				hero: expect.stringMatching(/^[a-f0-9]{64}$/),
			},
			scenarios: {
				Opening: expect.stringMatching(/^[a-f0-9]{64}$/),
			},
		});
		const readSnapshot = () =>
			Effect.runPromise(
				readVersionSnapshotFx({
					manifest: snapshot.manifest,
					paths,
				}).pipe(Effect.provide(NodeServices.layer)),
			);
		const restored = await readSnapshot();
		expect(restored).toEqual({
			arkpack: editorTestPayload.version,
			config: GameConfigSchema.parse({
				...editorTestPayload.config,
				$schema: GameProjectGameSchemaReference,
			}),
			resources: editorTestPayload.resources,
			scenarios: [
				{
					name: scenario.name,
					revision: scenario.projectRevision,
					version: scenario.version,
					save: "Bwg=",
					createdAtMs: scenario.createdAtMs,
					updatedAtMs: scenario.updatedAtMs,
				},
			],
			contentFingerprint: snapshot.contentFingerprint,
		});

		const objectFiles = (await readdir(paths.objects)).sort();
		expect(objectFiles).toHaveLength(5);
		await Promise.all(
			objectFiles.map((filename) => utimes(join(paths.objects, filename), 1, 1)),
		);
		const before = await Promise.all(
			objectFiles.map(
				async (filename) => (await stat(join(paths.objects, filename))).mtimeMs,
			),
		);
		const duplicate = await Effect.runPromise(
			writeSnapshotFx({
				arkpack: editorTestPayload.version,
				config: editorTestPayload.config,
				resources: [
					...editorTestPayload.resources,
				].reverse(),
				scenarios: [
					scenario,
				],
				paths,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		expect(duplicate).toEqual(snapshot);
		expect(
			await Promise.all(
				objectFiles.map(
					async (filename) => (await stat(join(paths.objects, filename))).mtimeMs,
				),
			),
		).toEqual(before);

		const gameObject = await Effect.runPromise(paths.jsonObjectFileFx(snapshot.manifest.game));
		await writeFile(gameObject, "corrupt");
		await expect(readSnapshot()).rejects.toThrow("failed its content hash check");
		await Effect.runPromise(
			writeSnapshotFx({
				arkpack: editorTestPayload.version,
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
				scenarios: [
					scenario,
				],
				paths,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		expect(await readSnapshot()).toEqual(restored);
	});

	it("rejects a symbolic-link object directory before writing snapshot bytes", async () => {
		const paths = await Effect.runPromise(
			createProjectPathsFx(root).pipe(Effect.provide(NodeServices.layer)),
		);
		const elsewhere = join(root, "elsewhere");
		await mkdir(elsewhere);
		await symlink(elsewhere, paths.objects);

		await expect(
			Effect.runPromise(
				writeSnapshotFx({
					arkpack: editorTestPayload.version,
					config: editorTestPayload.config,
					resources: editorTestPayload.resources,
					scenarios: [],
					paths,
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toThrow("must not be a symbolic link");
		expect(await readdir(elsewhere)).toEqual([]);
	});
});
