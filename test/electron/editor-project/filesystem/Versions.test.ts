import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Semaphore } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import type { ProjectState } from "../../../../electron/main/editor-project/filesystem/ProjectState";
import { createProjectPathsFx } from "../../../../electron/main/editor-project/filesystem/createProjectPathsFx";
import { createVersionOperationsFx } from "../../../../electron/main/editor-project/filesystem/fx/createVersionOperationsFx";
import { readProjectFilesFx } from "../../../../electron/main/editor-project/filesystem/fx/readProjectFilesFx";
import { readVersionHistoryFx } from "../../../../electron/main/editor-project/filesystem/fx/readVersionHistoryFx";
import { writeProjectFilesFx } from "../../../../electron/main/editor-project/filesystem/fx/writeProjectFilesFx";
import { EditorBoardScenarioSchema } from "~/board-scenario/schema/EditorBoardScenarioSchema";
import { EditorProjectCatalogEntrySchema } from "~/project-authoring/schema/EditorProjectCatalogEntrySchema";
import { GameProjectGameSchemaReference } from "~/game-config/source/GameProjectReference";
import { GameProjectManifestSchema } from "~/game-config/source/schema/GameProjectManifestSchema";
import { EditorVersionDescriptorFileSchema } from "~/project-version/schema/EditorVersionDescriptorFileSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { ArkiniVersionIncompatibleError } from "~/engine/version/ArkiniVersionAdmission";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

let root: string;
const encoder = new TextEncoder();

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
	it("publishes retry-safe full snapshots, ignores orphans, and restores exact state", async () => {
		const projectId = "editor-test";
		const canonicalConfig = GameConfigSchema.parse({
			...editorTestPayload.config,
			$schema: GameProjectGameSchemaReference,
		});
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
				const paths = yield* createProjectPathsFx(root);
				const filesystemWrite = yield* createFilesystemWriteFx();
				const writeJsonFx = (target: string, value: unknown) =>
					filesystemWrite.replaceFileFx({
						lock: join(root, "editor.lock"),
						target,
						bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
					});
				const marker = GameProjectManifestSchema.parse({
					arkini: ArkiniAppVersion,
					revision: 1,
				});
				yield* writeProjectFilesFx({
					root,
					next: {
						arkpack: "1.0",
						marker,
						config: canonicalConfig,
						resources: editorTestPayload.resources,
					},
				});
				yield* writeJsonFx(yield* paths.scenarioFileFx(initialScenario.name), {
					name: initialScenario.name,
					revision: initialScenario.projectRevision,
					version: initialScenario.version,
					save: "Bwg=",
					createdAtMs: initialScenario.createdAtMs,
					updatedAtMs: initialScenario.updatedAtMs,
				});
				const noteFile = yield* paths.noteFileFx("keep-me");
				yield* writeJsonFx(noteFile, {
					content: "Not versioned",
					createdAtMs: 1,
					updatedAtMs: 1,
				});

				const state: ProjectState = {
					catalog: EditorProjectCatalogEntrySchema.parse({
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
						config: canonicalConfig,
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
				const versions = yield* createVersionOperationsFx({
					filesystemWrite,
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
				const firstState = states.get(projectId);
				const firstVersion = firstState?.versionHistory.versions.get(first.versionId);
				if (firstState === undefined || firstVersion === undefined)
					return yield* Effect.die("Missing first version state.");
				const firstDescriptorFile = yield* paths.versionDescriptorFileFx(first.versionId);
				const writerMajor = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));
				yield* writeJsonFx(firstDescriptorFile, {
					...firstVersion.descriptor,
					arkini: `${writerMajor}.999.999`,
				});
				const admittedHistory = yield* readVersionHistoryFx(paths);
				states.set(projectId, {
					...firstState,
					versionHistory: admittedHistory,
				});
				const tagged = yield* versions.updateVersionTagFx({
					projectId,
					versionId: first.versionId,
					tag: "tested",
				});
				const taggedFile = JSON.parse(yield* fileSystemRead(firstDescriptorFile)) as {
					readonly arkini: string;
					readonly [key: string]: unknown;
				};
				const incompatibleWriter = `${Number(writerMajor) + 1}.0.0`;
				const incompatibleSource = `${JSON.stringify(
					{
						...taggedFile,
						arkini: incompatibleWriter,
					},
					undefined,
					"\t",
				)}\n`;
				yield* writeJsonFx(firstDescriptorFile, JSON.parse(incompatibleSource));
				const incompatibleError = yield* Effect.flip(readVersionHistoryFx(paths));
				const preservedIncompatibleSource = yield* fileSystemRead(firstDescriptorFile);
				yield* writeJsonFx(firstDescriptorFile, taggedFile);

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
				const changedMarker = GameProjectManifestSchema.parse({
					...marker,
					revision: 2,
				});
				yield* writeProjectFilesFx({
					root,
					previous: {
						arkpack: "1.0",
						marker,
						config: state.project.config,
						resources: state.project.resources,
					},
					next: {
						arkpack: "1.1",
						marker: changedMarker,
						config: changedConfig,
						resources: changedResources,
					},
				});
				yield* writeJsonFx(yield* paths.scenarioFileFx(changedScenario.name), {
					name: changedScenario.name,
					revision: changedScenario.projectRevision,
					version: changedScenario.version,
					save: "CQk=",
					createdAtMs: changedScenario.createdAtMs,
					updatedAtMs: changedScenario.updatedAtMs,
				});
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
				const validVersionState = states.get(projectId);
				if (validVersionState === undefined)
					return yield* Effect.die("Missing version state.");
				const secondVersion = validVersionState.versionHistory.versions.get(
					second.versionId,
				);
				if (secondVersion === undefined)
					return yield* Effect.die("Missing second version.");
				states.set(projectId, {
					...validVersionState,
					versionHistory: {
						...validVersionState.versionHistory,
						versions: new Map(validVersionState.versionHistory.versions).set(
							second.versionId,
							{
								...secondVersion,
								descriptor: EditorVersionDescriptorFileSchema.parse({
									...secondVersion.descriptor,
									version: "9.9",
								}),
							},
						),
					},
				});
				const mismatchedDiffError = yield* Effect.flip(
					versions.diffVersionsFx({
						projectId,
						from: {
							type: "version",
							versionId: first.versionId,
						},
						to: {
							type: "version",
							versionId: second.versionId,
						},
					}),
				);
				states.set(projectId, validVersionState);

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
							current: first.versionId,
							versions: [
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
				const restoredFiles = yield* readProjectFilesFx(root);
				const restoredScenario = JSON.parse(
					yield* fileSystemRead(yield* paths.scenarioFileFx(initialScenario.name)),
				) as unknown;
				const head = JSON.parse(yield* fileSystemRead(paths.versionHeadFile)) as {
					readonly current: string;
					readonly versions: ReadonlyArray<string>;
				};
				const status = yield* versions.readVersionStatusFx(projectId);
				return {
					admittedWriter: admittedHistory.versions.get(first.versionId)?.descriptor
						.arkini,
					first,
					incompatibleError,
					incompatibleSource,
					incompatibleWriter,
					preservedIncompatibleSource,
					retry,
					second,
					mismatchedDiffError,
					listed,
					diff,
					restoredFiles,
					restoredScenario,
					restoredState: states.get(projectId),
					status,
					tagged,
					taggedFile,
					head,
					noteFile,
				};
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(result.retry).toEqual(result.first);
		expect(result.admittedWriter).toBe(
			`${ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."))}.999.999`,
		);
		expect(result.tagged.arkini).toBe(ArkiniAppVersion);
		expect(result.taggedFile.arkini).toBe(ArkiniAppVersion);
		expect(result.incompatibleError).toBeInstanceOf(ArkiniVersionIncompatibleError);
		expect(result.incompatibleError).toMatchObject({
			artifact: "Editor version",
			writerVersion: result.incompatibleWriter,
			readerVersion: ArkiniAppVersion,
		});
		expect(result.preservedIncompatibleSource).toBe(result.incompatibleSource);
		expect(result.second.parentVersionId).toBe(result.first.versionId);
		expect(String(result.mismatchedDiffError.cause)).toContain(
			"Arkpack version does not match its descriptor",
		);
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
		expect(result.restoredFiles.config).toEqual(canonicalConfig);
		expect(result.restoredFiles.resources).toEqual(editorTestPayload.resources);
		expect(result.restoredScenario).toMatchObject({
			name: "Opening",
			revision: restoredRevision,
			version: "1.0",
			save: "Bwg=",
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
			current: result.first.versionId,
			versions: [
				result.first.versionId,
				result.second.versionId,
			],
		});
		expect(await readFile(result.noteFile, "utf8")).toContain("Not versioned");
	}, 10_000);
});

const fileSystemRead = (target: string) => Effect.promise(() => readFile(target, "utf8"));
