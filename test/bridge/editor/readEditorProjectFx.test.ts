import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { createEditorProjectPlanFx } from "~/engine/editor/fx/createEditorProjectPlanFx";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

const createWorkspace = (
	readFx: EditorWorkspace["readFx"],
): EditorWorkspace => ({
	createFx: () => Effect.void,
	readFx,
	openDirectoryFx: () => Effect.void,
});

describe("readEditorProjectFx", () => {
	it("reads and recompiles one standalone editor workspace", async () => {
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "a".repeat(64),
				payload: editorTestPayload,
			}),
		);
		const project = await Effect.runPromise(
			readEditorProjectFx({
				projectId: plan.projectId,
				workspace: createWorkspace(() =>
					Effect.succeed({
						projectId: plan.projectId,
						files: plan.files,
					}),
				),
			}),
		);

		expect(project).toEqual({
			projectId: "editor-test",
			config: editorTestConfig,
			resources: editorTestPayload.resources,
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
		await expect(
			Effect.runPromise(
				readEditorProjectFx({
					projectId: "expected",
					workspace: createWorkspace(() =>
						Effect.succeed({
							projectId: "different",
							files: [
								{
									path: "game.json",
									bytes: new TextEncoder().encode("{}\n"),
								},
							],
						}),
					),
				}),
			),
		).rejects.toThrow("returned workspace different");
	});
});
