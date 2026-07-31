import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorProjectManifestFileFx } from "~/bridge/editor/createEditorProjectManifestFileFx";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { createEditorProjectPlanFx } from "~/engine/editor/fx/createEditorProjectPlanFx";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

const createWorkspace = (readFx: EditorWorkspace["readFx"]): EditorWorkspace => ({
	listFx: () => Effect.succeed([]),
	createFx: () => Effect.void,
	readFx,
	writeFx: () => Effect.die("Unexpected editor project write."),
	openDirectoryFx: () => Effect.void,
});

const createManifest = (projectId: string, title = "Editor test", game?: string) =>
	Effect.runPromise(
		createEditorProjectManifestFileFx({
			projectId,
			title,
			...(game === undefined
				? {}
				: {
						game,
					}),
			nowMs: 123,
		}),
	);

describe("readEditorProjectFx", () => {
	it("reads the manifest and recompiles one standalone editor workspace", async () => {
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "a".repeat(64),
				payload: editorTestPayload,
			}),
		);
		const manifest = await createManifest(plan.projectId, "Editor test", "1.0");
		const project = await Effect.runPromise(
			readEditorProjectFx({
				projectId: plan.projectId,
				workspace: createWorkspace(() =>
					Effect.succeed({
						projectId: plan.projectId,
						revision: "0".repeat(64),
						files: [
							manifest.file,
							...plan.files,
						],
					}),
				),
			}),
		);

		const files = [manifest.file, ...plan.files];
		expect(project).toEqual({
			projectId: "editor-test",
			title: "Editor test",
			game: "1.0",
			createdAtMs: 123,
			updatedAtMs: 123,
			revision: "0".repeat(64),
			fileIndex: Object.fromEntries(files.map((file) => [file.path, file])),
			itemSourcePaths: {
				water: "simple/water.json",
			},
			config: editorTestConfig,
			resources: editorTestPayload.resources,
			resourceSourcePaths: {
				hero: "resources/hero.png",
				"item-water": "assets/item-water.png",
			},
			diagnostics: [],
		});
	});

	it("loads a new project containing only editor.json", async () => {
		const manifest = await createManifest("empty-project", "Empty project", undefined);
		await expect(
			Effect.runPromise(
				readEditorProjectFx({
					projectId: "empty-project",
					workspace: createWorkspace(() =>
						Effect.succeed({
							projectId: "empty-project",
							revision: "0".repeat(64),
							files: [
								manifest.file,
							],
						}),
					),
				}),
			),
		).resolves.toEqual({
			projectId: "empty-project",
			title: "Empty project",
			createdAtMs: 123,
			updatedAtMs: 123,
			revision: "0".repeat(64),
			fileIndex: {
				"editor.json": manifest.file,
			},
			itemSourcePaths: {},
			resources: [],
			resourceSourcePaths: {},
			diagnostics: [],
		});
	});

	it("loads a manifest-backed project before game.json exists", async () => {
		const manifest = await createManifest("partial-project", "Partial project", undefined);
		await expect(
			Effect.runPromise(
				readEditorProjectFx({
					projectId: "partial-project",
					workspace: createWorkspace(() =>
						Effect.succeed({
							projectId: "partial-project",
							revision: "0".repeat(64),
							files: [
								manifest.file,
								{
									path: "assets/hero.png",
									bytes: new Uint8Array([
										1,
										2,
										3,
									]),
								},
							],
						}),
					),
				}),
			),
		).resolves.toEqual({
			projectId: "partial-project",
			title: "Partial project",
			createdAtMs: 123,
			updatedAtMs: 123,
			revision: "0".repeat(64),
			fileIndex: {
				"editor.json": manifest.file,
				"assets/hero.png": {
					path: "assets/hero.png",
					bytes: new Uint8Array([1, 2, 3]),
				},
			},
			itemSourcePaths: {},
			resources: [],
			resourceSourcePaths: {},
			diagnostics: [],
		});
	});

	it("fails when the requested editor workspace does not exist", async () => {
		await expect(
			Effect.runPromise(
				readEditorProjectFx({
					projectId: "missing",
					workspace: createWorkspace(() => Effect.succeed(null)),
				}),
			),
		).rejects.toThrow("Editor project missing does not exist");
	});

	it("rejects a workspace record returned under another project identity", async () => {
		const manifest = await createManifest("different");
		await expect(
			Effect.runPromise(
				readEditorProjectFx({
					projectId: "expected",
					workspace: createWorkspace(() =>
						Effect.succeed({
							projectId: "different",
							revision: "0".repeat(64),
							files: [
								manifest.file,
							],
						}),
					),
				}),
			),
		).rejects.toThrow("returned workspace different");
	});
});
