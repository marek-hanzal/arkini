import * as NodeServices from "@effect/platform-node/NodeServices";
import {
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Semaphore } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FilesystemEditorProjectState } from "../../../../electron/main/editor-project/filesystem/FilesystemEditorProjectState";
import { createEditorProjectFilesystemPathsFx } from "../../../../electron/main/editor-project/filesystem/createEditorProjectFilesystemPathsFx";
import { createFilesystemEditorProjectVersionOperationsFx } from "../../../../electron/main/editor-project/filesystem/fx/createFilesystemEditorProjectVersionOperationsFx";
import { readFilesystemEditorProjectFilesFx } from "../../../../electron/main/editor-project/filesystem/fx/readFilesystemEditorProjectFilesFx";
import { replaceFilesystemEditorJsonFx } from "../../../../electron/main/editor-project/filesystem/fx/replaceFilesystemEditorJsonFx";
import { writeFilesystemEditorProjectFilesFx } from "../../../../electron/main/editor-project/filesystem/fx/writeFilesystemEditorProjectFilesFx";
import { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";
import { EditorProjectCatalogEntrySchema } from "~/editor/filesystem/EditorProjectCatalogEntrySchema";
import { EditorProjectFileSchema } from "~/editor/filesystem/EditorProjectFileSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-filesystem-versions-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("filesystem Editor project versions", () => {
	it("publishes retry-safe full snapshots, ignores orphans, and protects version paths", async () => {
		const projectId = "editor-test";
		const initialScenario = EditorBoardScenarioSchema.parse({
			projectId,
			name: "Opening",
			projectRevision: 1,
			version: "1.0",
			bytes: Uint8Array.of(7, 8),
			createdAtMs: 1,
			updatedAtMs: 1,
		});
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const paths = yield* createEditorProjectFilesystemPathsFx(root);
				const marker = EditorProjectFileSchema.parse({
					format: "arkini-editor",
					formatVersion: 1,
					arkpackVersion: "1.0",
					updatedAtMs: 1,
				});
				yield* writeFilesystemEditorProjectFilesFx({
					root,
					next: {
						marker,
						config: editorTestPayload.config,
						resources: editorTestPayload.resources,
					},
				});
				yield* replaceFilesystemEditorJsonFx(
					yield* paths.scenarioFileFx(initialScenario.name),
					{
						name: initialScenario.name,
						projectRevision: initialScenario.projectRevision,
						arkpackVersion: initialScenario.version,
						bytesBase64: "Bwg=",
						createdAtMs: initialScenario.createdAtMs,
						updatedAtMs: initialScenario.updatedAtMs,
					},
				);
				const noteFile = yield* paths.noteFileFx("keep-me");
				yield* replaceFilesystemEditorJsonFx(noteFile, {
					noteId: "keep-me",
					content: "Not versioned",
					createdAtMs: 1,
					updatedAtMs: 1,
				});

				const state: FilesystemEditorProjectState = {
					catalog: EditorProjectCatalogEntrySchema.parse({
						projectId,
						root,
						ownership: "external",
						createdAtMs: 1,
					}),
					notes: [],
					paths,
					project: {
						projectId,
						title: editorTestPayload.config.meta.title,
						version: "1.0",
						createdAtMs: 1,
						updatedAtMs: 1,
						revision: 1,
						config: editorTestPayload.config,
						resources: editorTestPayload.resources,
					},
					scenarios: [
						initialScenario,
					],
					versionHistory: {
						versions: new Map(),
					},
				};
				const states = new Map([
					[
						projectId,
						state,
					],
				]);
				const operations = yield* Semaphore.make(1);
				const versions = yield* createFilesystemEditorProjectVersionOperationsFx({
					operations,
					readState: (id) => {
						const found = states.get(id);
						return found === undefined
							? Effect.die(`Missing project ${id}.`)
							: Effect.succeed(found);
					},
					states,
				});

				const preview = yield* versions.readVersionStatusFx(projectId);
				const first = yield* versions.createVersionFx({
					projectId,
					expectedFingerprint: preview.currentFingerprint,
					subject: "Initial",
				});
				const retry = yield* versions.createVersionFx({
					projectId,
					expectedFingerprint: preview.currentFingerprint,
					subject: "Initial",
				});

				const changedConfig = GameConfigSchema.parse({
					...state.project.config,
					meta: {
						...state.project.config.meta,
						title: "Changed",
					},
				});
				const changedResources = state.project.resources.map((resource) =>
					resource.id === "hero"
						? {
								...resource,
								bytes: Uint8Array.of(9),
							}
						: resource,
				);
				const changedScenario = EditorBoardScenarioSchema.parse({
					...initialScenario,
					projectRevision: 2,
					version: "1.1",
					bytes: Uint8Array.of(9, 9),
					updatedAtMs: 2,
				});
				const changedMarker = EditorProjectFileSchema.parse({
					...marker,
					arkpackVersion: "1.1",
					updatedAtMs: 2,
				});
				yield* writeFilesystemEditorProjectFilesFx({
					root,
					previous: {
						marker,
						config: state.project.config,
						resources: state.project.resources,
					},
					next: {
						marker: changedMarker,
						config: changedConfig,
						resources: changedResources,
					},
				});
				yield* replaceFilesystemEditorJsonFx(
					yield* paths.scenarioFileFx(changedScenario.name),
					{
						name: changedScenario.name,
						projectRevision: changedScenario.projectRevision,
						arkpackVersion: changedScenario.version,
						bytesBase64: "CQk=",
						createdAtMs: changedScenario.createdAtMs,
						updatedAtMs: changedScenario.updatedAtMs,
					},
				);
				const currentState = states.get(projectId);
				if (currentState === undefined) return yield* Effect.die("Missing current state.");
				states.set(projectId, {
					...currentState,
					project: {
						...currentState.project,
						title: "Changed",
						version: "1.1",
						updatedAtMs: 2,
						revision: 2,
						config: changedConfig,
						resources: changedResources,
					},
					scenarios: [
						changedScenario,
					],
				});
				const second = yield* versions.createVersionFx({
					projectId,
					subject: "Changed",
				});

				const orphanDirectory = yield* paths.versionDirectoryFx("orphan");
				yield* Effect.promise(() =>
					mkdir(orphanDirectory, {
						recursive: true,
					}),
				);
				yield* Effect.promise(() =>
					writeFile(join(orphanDirectory, "version.json"), "broken"),
				);
				yield* Effect.promise(() =>
					writeFile(
						paths.versionHeadFile,
						JSON.stringify({
							versionId: first.versionId,
							versionIds: [
								first.versionId,
							],
						}),
					),
				);
				const listed = yield* versions.listVersionsFx(projectId);
				const diff = yield* versions.diffVersionsFx({
					projectId,
					from: {
						type: "version",
						versionId: first.versionId,
					},
					to: {
						type: "version",
						versionId: second.versionId,
					},
				});
				yield* versions.checkoutVersionFx({
					projectId,
					versionId: first.versionId,
				});
				const restoredFiles = yield* readFilesystemEditorProjectFilesFx(root);
				const restoredScenario = JSON.parse(
					yield* fileSystemRead(yield* paths.scenarioFileFx(initialScenario.name)),
				) as unknown;
				const head = JSON.parse(yield* fileSystemRead(paths.versionHeadFile)) as {
					readonly versionId: string;
					readonly versionIds: ReadonlyArray<string>;
				};
				const status = yield* versions.readVersionStatusFx(projectId);
				const realVersions = join(root, "versions-real");
				const elsewhere = join(root, "elsewhere");
				yield* Effect.promise(() => rename(paths.versions, realVersions));
				yield* Effect.promise(() => mkdir(elsewhere));
				yield* Effect.promise(() => symlink(elsewhere, paths.versions));
				const symlinkError = yield* Effect.flip(
					versions.updateVersionTagFx({
						projectId,
						versionId: first.versionId,
						tag: "protected",
					}),
				);
				return {
					first,
					retry,
					second,
					listed,
					diff,
					restoredFiles,
					restoredScenario,
					restoredState: states.get(projectId),
					status,
					head,
					noteFile,
					elsewhere,
					symlinkError,
				};
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(result.retry).toEqual(result.first);
		expect(result.second.parentVersionId).toBe(result.first.versionId);
		expect(result.listed.map(({ versionId }) => versionId)).toEqual([
			result.second.versionId,
			result.first.versionId,
		]);
		expect(result.diff).toMatchObject({
			hasChanges: true,
			resources: [
				{
					change: "changed",
					id: "hero",
				},
			],
			scenarios: [
				{
					change: "changed",
					id: "Opening",
				},
			],
		});
		const restoredRevision = result.restoredState?.project.revision;
		expect(restoredRevision).toBeDefined();
		expect(result.restoredFiles.config).toEqual(editorTestPayload.config);
		expect(result.restoredFiles.resources).toEqual(editorTestPayload.resources);
		expect(result.restoredScenario).toMatchObject({
			name: "Opening",
			projectRevision: restoredRevision,
			arkpackVersion: "1.0",
			bytesBase64: "Bwg=",
		});
		expect(result.restoredState?.scenarios).toEqual([
			{
				...initialScenario,
				projectRevision: restoredRevision,
			},
		]);
		expect(result.status).toMatchObject({
			currentBaseVersionId: result.first.versionId,
			dirty: false,
			versionCount: 2,
		});
		expect(result.head).toEqual({
			versionId: result.first.versionId,
			versionIds: [
				result.first.versionId,
				result.second.versionId,
			],
		});
		expect(String(result.symlinkError.cause)).toContain("must not be a symbolic link");
		expect(await readdir(result.elsewhere)).toEqual([]);
		expect(await readFile(result.noteFile, "utf8")).toContain("Not versioned");
	});
});

const fileSystemRead = (target: string) => Effect.promise(() => readFile(target, "utf8"));
