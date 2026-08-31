// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { EditorProjectRepositoryService } from "~/project-authoring/service/EditorProjectRepository";
import { installEditorMcpVersionCheckoutFx } from "~/authoring-mcp/fx/installEditorMcpVersionCheckoutFx";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

describe("installEditorMcpVersionCheckoutFx", () => {
	it("uses the renderer checkout coordinator and returns to the refreshed history", async () => {
		const project: EditorProject = {
			projectId: "project-one",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 2,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		};
		const checkoutVersionFx = vi.fn(() => Effect.void);
		const repository: EditorProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			checkoutVersionFx,
			createProjectFx: () => Effect.die("Unexpected project create."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			listProjectsFx: Effect.die("Unexpected project list."),
			readProjectFx: () => Effect.succeed(project),
			readVersionStatusFx: () =>
				Effect.succeed({
					canCommit: true,
					currentFingerprint: "a".repeat(64),
					dirty: true,
					versionCount: 1,
				}),
			replaceConfigFx: () => Effect.die("Unexpected config write."),
			replaceResourceFx: () => Effect.die("Unexpected resource write."),
			upsertItemFx: () => Effect.die("Unexpected item write."),
			upsertResourcesFx: () => Effect.die("Unexpected resources write."),
		};
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.never,
			editorProjectRepository: repository,
		});
		runtimes.push(rendererRuntime);
		let listener:
			| ((request: { projectId: string; versionId: string }) => Promise<void>)
			| undefined;
		const remove = vi.fn();
		const navigate = vi.fn(() => Promise.resolve());
		const router = {
			navigate,
			state: {
				matches: [
					{
						params: {
							projectId: "project-one",
						},
					},
				],
			},
		} as unknown as Pick<ArkiniRouter, "navigate" | "state">;
		const uninstall = rendererRuntime.runSync(
			installEditorMcpVersionCheckoutFx({
				editorMcp: {
					onVersionCheckoutRequested: (next) => {
						listener = next;
						return remove;
					},
				},
				rendererRuntime,
				router,
			}),
		);
		if (listener === undefined) throw new Error("Expected checkout listener.");

		await expect(
			listener({
				projectId: "another-project",
				versionId: "version-one",
			}),
		).rejects.toThrow("no longer open");
		await listener({
			projectId: "project-one",
			versionId: "version-one",
		});

		expect(checkoutVersionFx).toHaveBeenCalledWith({
			projectId: "project-one",
			versionId: "version-one",
			expectedFingerprint: "a".repeat(64),
		});
		expect(navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/versions/history",
			params: {
				projectId: "project-one",
			},
			replace: true,
		});
		uninstall();
		expect(remove).toHaveBeenCalledOnce();
	});
});
